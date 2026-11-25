// Package groupwriter writes rule groups converted from Prometheus through the rules API. It writes
// each group's rules with their group, and a rule sequence for each group with a recording rule,
// so that the group's recording rules are evaluated before its alert rules, in one chain at the
// group's interval.
package groupwriter

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/grafana/grafana-app-sdk/resource"

	"github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v1beta1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/prom"
)

const (
	defaultRetries      = 5
	defaultRetryBackoff = 100 * time.Millisecond
)

var errRulesAPIUnavailable = errors.New("the rules API is not available")

// GroupKey identifies a converted rule group.
type GroupKey struct {
	FolderUID string
	Title     string
}

// Writer writes converted rule groups and their rule sequences. Everything is written with the
// identity in the context, so the caller's permissions apply.
type Writer struct {
	clients      resource.ClientGenerator
	namespace    request.NamespaceMapper
	logger       log.Logger
	retries      int
	retryBackoff time.Duration
}

func NewWriter(clients resource.ClientGenerator, namespace request.NamespaceMapper, logger log.Logger) *Writer {
	return &Writer{
		clients:      clients,
		namespace:    namespace,
		logger:       logger,
		retries:      defaultRetries,
		retryBackoff: defaultRetryBackoff,
	}
}

// SequenceUID is the name of the rule sequence of a converted group. It is stable across re-imports.
func SequenceUID(orgID int64, folderUID, group string) string {
	return prom.StableUUID(fmt.Sprintf("sequence|%d|%s|%s", orgID, folderUID, group)).String()
}

type clients struct {
	namespace string
	sequences *v1beta1.RuleSequenceClient
	rules     map[string]resource.Client
}

func (w *Writer) clientsFor(orgID int64) (*clients, error) {
	if w.clients == nil {
		return nil, errRulesAPIUnavailable
	}
	sequences, err := v1beta1.NewRuleSequenceClientFromGenerator(w.clients)
	if err != nil {
		return nil, fmt.Errorf("create rule sequence client: %w", err)
	}
	c := &clients{namespace: w.namespace(orgID), sequences: sequences, rules: make(map[string]resource.Client, len(ruleKinds))}
	for _, kind := range ruleKinds {
		client, err := w.clients.ClientFor(kind)
		if err != nil {
			return nil, fmt.Errorf("create %s client: %w", kind.Kind(), err)
		}
		c.rules[kind.Kind()] = client
	}
	return c, nil
}

// ReplaceGroups replaces each group's rules with the given ones and keeps the group's rule sequence
// in step. The groups are written one after the other, and a group's writes are not atomic: a failed
// write leaves the group partly written, and writing the same groups again completes it.
//
// Rule admission rejects deleting a rule that still belongs to a sequence, so rules that a group no
// longer contains are first removed from its sequence. Rules have to exist before a sequence can
// reference them, so the sequence is completed last.
func (w *Writer) ReplaceGroups(ctx context.Context, orgID int64, groups []*models.AlertRuleGroup, manager utils.ManagerProperties) error {
	c, err := w.clientsFor(orgID)
	if err != nil {
		return err
	}
	for _, g := range groups {
		if err := w.shrink(ctx, c, orgID, g); err != nil {
			return fmt.Errorf("remove dropped rules from the rule sequence of group %q: %w", g.Title, err)
		}
		if err := w.writeRules(ctx, c, orgID, g, manager); err != nil {
			return err
		}
		if err := w.upsert(ctx, c, orgID, g, models.ManagerPropertiesToProvenance(manager)); err != nil {
			return fmt.Errorf("write the rule sequence of group %q: %w", g.Title, err)
		}
	}
	return nil
}

// DeleteGroups deletes the converted rules of the groups, and the groups' rule sequences. It returns
// models.ErrAlertRuleGroupNotFound when none of the groups has a converted rule.
func (w *Writer) DeleteGroups(ctx context.Context, orgID int64, groups []GroupKey, manager utils.ManagerProperties) error {
	c, err := w.clientsFor(orgID)
	if err != nil {
		return err
	}
	found := false
	for _, g := range groups {
		rules, err := w.listRules(ctx, c, g.FolderUID)
		if err != nil {
			return err
		}
		rules = converted(inGroup(rules, g.Title))
		found = found || len(rules) > 0
		if err := w.deleteGroup(ctx, c, orgID, g, rules, manager); err != nil {
			return err
		}
	}
	if !found {
		return models.ErrAlertRuleGroupNotFound
	}
	return nil
}

// DeleteFolder deletes the converted rules in the folder, and the rule sequences of their groups. It
// returns models.ErrAlertRuleGroupNotFound when the folder has no converted rule.
func (w *Writer) DeleteFolder(ctx context.Context, orgID int64, folderUID string, manager utils.ManagerProperties) error {
	c, err := w.clientsFor(orgID)
	if err != nil {
		return err
	}
	rules, err := w.listRules(ctx, c, folderUID)
	if err != nil {
		return err
	}
	rules = converted(rules)
	if len(rules) == 0 {
		return models.ErrAlertRuleGroupNotFound
	}
	var titles []string
	byGroup := map[string][]rule{}
	for _, r := range rules {
		title := r.obj.GetLabels()[v1beta1.GroupLabelKey]
		if _, ok := byGroup[title]; !ok {
			titles = append(titles, title)
		}
		byGroup[title] = append(byGroup[title], r)
	}
	for _, title := range titles {
		if err := w.deleteGroup(ctx, c, orgID, GroupKey{FolderUID: folderUID, Title: title}, byGroup[title], manager); err != nil {
			return err
		}
	}
	return nil
}

// deleteGroup deletes the group's sequence before its rules, because rule admission rejects deleting
// a rule that belongs to a sequence.
func (w *Writer) deleteGroup(ctx context.Context, c *clients, orgID int64, g GroupKey, rules []rule, manager utils.ManagerProperties) error {
	if err := deleteSequence(ctx, c, SequenceUID(orgID, g.FolderUID, g.Title)); err != nil {
		return fmt.Errorf("delete the rule sequence of group %q: %w", g.Title, err)
	}
	for _, r := range rules {
		if err := w.deleteRule(ctx, c, r, manager); err != nil {
			return fmt.Errorf("delete rule %q of group %q: %w", r.obj.GetName(), g.Title, err)
		}
	}
	return nil
}

// retryWhileSequenceMember retries write while rule admission rejects it because a rule still
// belongs to a sequence. The membership that admission checks is updated asynchronously after a
// sequence changes, so the rejection is expected for a short while.
func (w *Writer) retryWhileSequenceMember(ctx context.Context, write func(context.Context) error) error {
	for attempt := 0; ; attempt++ {
		err := write(ctx)
		if err == nil || attempt == w.retries || !v1beta1.IsRuleSequenceMemberError(err) {
			return err
		}
		w.logger.FromContext(ctx).Debug("Retrying rule write rejected while rule sequence membership updates", "attempt", attempt+1, "error", err)
		if w.wait(ctx, attempt) != nil {
			return err
		}
	}
}

func (w *Writer) wait(ctx context.Context, attempt int) error {
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-time.After(w.retryBackoff << attempt):
		return nil
	}
}

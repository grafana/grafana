package pulse

import (
	"context"
	"strings"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/notifications"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

const (
	tmplPulseMention = "pulse_mention"
	tmplPulseReply   = "pulse_reply"

	emailBodyPreviewBytes = 280
)

// EmailNotifier delivers Pulse fanout events as transactional email. It is
// gated by the dashboardPulseEmail feature toggle at wire time; if SMTP is
// not configured the email service itself will return ErrSmtpNotEnabled and
// we log-and-continue so a misconfigured deployment can never block the
// HTTP request that produced the fanout.
type EmailNotifier struct {
	mailer notifications.EmailSender
	users  user.Service
	cfg    *setting.Cfg
	log    log.Logger
}

// NewEmailNotifier constructs an EmailNotifier. All deps are required; pass
// a non-nil mailer or wire is doing something wrong.
func NewEmailNotifier(mailer notifications.EmailSender, users user.Service, cfg *setting.Cfg, logger log.Logger) *EmailNotifier {
	if logger == nil {
		logger = log.New("pulse.email")
	}
	return &EmailNotifier{
		mailer: mailer,
		users:  users,
		cfg:    cfg,
		log:    logger,
	}
}

func (n *EmailNotifier) NotifyPulse(ctx context.Context, e PulseNotification) error {
	if n.mailer == nil || n.users == nil {
		return nil
	}

	author := n.resolveDisplayName(ctx, e.AuthorUserID)
	threadURL := n.threadURL(e)
	preview := truncate(strings.TrimSpace(e.BodyText), emailBodyPreviewBytes)
	title := e.ThreadTitle
	if title == "" {
		title = "a Pulse thread"
	}

	for _, uid := range e.Recipients {
		u, err := n.users.GetByID(ctx, &user.GetUserByIDQuery{ID: uid})
		if err != nil {
			n.log.Warn("pulse email recipient lookup failed", "err", err, "recipientUserID", uid)
			continue
		}
		if u == nil || u.IsDisabled || strings.TrimSpace(u.Email) == "" {
			continue
		}

		isMention := e.IsMention[uid]
		template := tmplPulseReply
		subject := "[Grafana] New reply in \"" + title + "\""
		if isMention {
			template = tmplPulseMention
			subject = "[Grafana] " + author + " mentioned you in \"" + title + "\""
		}

		recipientName := strings.TrimSpace(u.Name)
		if recipientName == "" {
			recipientName = u.Login
		}

		cmd := &notifications.SendEmailCommand{
			To:       []string{u.Email},
			Template: template,
			Subject:  subject,
			Data: map[string]any{
				"AuthorName":    author,
				"ThreadTitle":   title,
				"BodyPreview":   preview,
				"ThreadURL":     threadURL,
				"RecipientName": recipientName,
				"IsMention":     isMention,
				"ResourceKind":  string(e.ResourceKind),
			},
		}
		if err := n.mailer.SendEmailCommandHandler(ctx, cmd); err != nil {
			n.log.Warn("pulse email send failed",
				"err", err,
				"recipientUserID", uid,
				"template", template,
				"threadUID", e.ThreadUID,
			)
		}
	}
	return nil
}

// resolveDisplayName turns the author user id into a human-readable label.
// Falls back to "Someone" so the subject line never reads "  mentioned
// you" when the user has been deleted.
func (n *EmailNotifier) resolveDisplayName(ctx context.Context, userID int64) string {
	if userID <= 0 {
		return "Someone"
	}
	u, err := n.users.GetByID(ctx, &user.GetUserByIDQuery{ID: userID})
	if err != nil || u == nil {
		return "Someone"
	}
	if name := strings.TrimSpace(u.Name); name != "" {
		return name
	}
	if u.Login != "" {
		return u.Login
	}
	return "Someone"
}

// threadURL builds an absolute deeplink that opens the dashboard (or the
// Pulse overview) with the thread auto-expanded. Mirrors the `?pulse=thread-<uid>`
// pattern the frontend overview row already produces.
func (n *EmailNotifier) threadURL(e PulseNotification) string {
	root := strings.TrimRight(n.cfg.AppURL, "/") + "/"
	if e.ResourceKind == ResourceKindDashboard && e.ResourceUID != "" {
		return root + "d/" + e.ResourceUID + "?pulse=thread-" + e.ThreadUID
	}
	return root + "pulse?thread=" + e.ThreadUID
}

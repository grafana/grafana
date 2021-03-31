package notifier

import (
	"fmt"
	"time"

	apimodels "github.com/grafana/alerting-api/pkg/api"
	"github.com/pkg/errors"
	v2 "github.com/prometheus/alertmanager/api/v2"
	"github.com/prometheus/alertmanager/pkg/labels"
	"github.com/prometheus/alertmanager/silence"
)

var (
	ErrGetSilencesInternal     = errors.New("unable to retrieve silence(s) due to an internal error")
	ErrDeleteSilenceInternal   = errors.New("unable to delete silence due to an internal error")
	ErrCreateSilenceBadPayload = errors.New("unable to create silence")
	ErrListSilencesBadPayload  = errors.New("unable to list silences")
	ErrSilenceNotFound         = silence.ErrNotFound
)

// ListSilences retrieves a list of stored silences. It supports a set of labels as filters.
func (am *Alertmanager) ListSilences(filters []string) (apimodels.GettableSilences, error) {
	matchers := []*labels.Matcher{}
	for _, matcherString := range filters {
		matcher, err := labels.ParseMatcher(matcherString)
		if err != nil {
			am.logger.Error("failed to parse matcher", "err", err, "matcher", matcherString)
			return nil, errors.Wrap(ErrListSilencesBadPayload, err.Error())
		}

		matchers = append(matchers, matcher)
	}

	psils, _, err := am.silences.Query()
	if err != nil {
		am.logger.Error(ErrGetSilencesInternal.Error(), "err", err)
		return nil, errors.Wrap(ErrGetSilencesInternal, err.Error())
	}

	sils := apimodels.GettableSilences{}
	for _, ps := range psils {
		if !v2.CheckSilenceMatchesFilterLabels(ps, matchers) {
			continue
		}
		silence, err := v2.GettableSilenceFromProto(ps)
		if err != nil {
			am.logger.Error("unmarshaling from protobuf failed", "err", err)
			return apimodels.GettableSilences{}, errors.Wrap(ErrGetSilencesInternal, fmt.Sprintf("failed to convert internal silence to API silence: %v", err.Error()))
		}
		sils = append(sils, &silence)
	}

	v2.SortSilences(sils)

	return sils, nil
}

// GetSilence retrieves a silence by the provided silenceID. It returns ErrSilenceNotFound if the silence is not present.
func (am *Alertmanager) GetSilence(silenceID string) (apimodels.GettableSilence, error) {
	sils, _, err := am.silences.Query(silence.QIDs(silenceID))
	if err != nil {
		return apimodels.GettableSilence{}, errors.Wrap(ErrGetSilencesInternal, err.Error())
	}

	if len(sils) == 0 {
		am.logger.Error("failed to find silence", "err", err, "id", sils)
		return apimodels.GettableSilence{}, ErrSilenceNotFound
	}

	sil, err := v2.GettableSilenceFromProto(sils[0])
	if err != nil {
		am.logger.Error("unmarshaling from protobuf failed", "err", err)
		return apimodels.GettableSilence{}, errors.Wrap(ErrGetSilencesInternal, fmt.Sprintf("failed to convert internal silence to API silence: %v", err.Error()))
	}

	return sil, nil
}

// CreateSilence persists the provided silence and returns the silence ID if successful.
func (am *Alertmanager) CreateSilence(ps *apimodels.PostableSilence) (string, error) {
	sil, err := v2.PostableSilenceToProto(ps)
	if err != nil {
		am.logger.Error("marshaling to protobuf failed", "err", err)
		return "", errors.Wrap(ErrCreateSilenceBadPayload, fmt.Sprintf("failed to convert API silence to internal silence: %v", err.Error()))
	}

	if sil.StartsAt.After(sil.EndsAt) || sil.StartsAt.Equal(sil.EndsAt) {
		msg := "start time must be before end time"
		am.logger.Error(msg, "err", "starts_at", sil.StartsAt, "ends_at", sil.EndsAt)
		return "", errors.Wrap(ErrCreateSilenceBadPayload, msg)
	}

	if sil.EndsAt.Before(time.Now()) {
		msg := "end time can't be in the past"
		am.logger.Error(msg, "ends_at", sil.EndsAt)
		return "", errors.Wrap(ErrCreateSilenceBadPayload, msg)
	}

	silenceID, err := am.silences.Set(sil)
	if err != nil {
		am.logger.Error("msg", "unable to save silence", "err", err)
		if errors.Is(err, silence.ErrNotFound) {
			return "", ErrSilenceNotFound
		}
		return "", errors.Wrap(ErrCreateSilenceBadPayload, fmt.Sprintf("unable to save silence: %v", err.Error()))
	}

	return silenceID, nil
}

// DeleteSilence looks for and expires the silence by the provided silenceID. It returns ErrSilenceNotFound if the silence is not present.
func (am *Alertmanager) DeleteSilence(silenceID string) error {
	if err := am.silences.Expire(silenceID); err != nil {
		if errors.Is(err, silence.ErrNotFound) {
			return ErrSilenceNotFound
		}
		return errors.Wrap(ErrDeleteSilenceInternal, err.Error())
	}

	return nil
}

package notifier

// MergeState incorporates external nflog entries and silences to the Alertmanager's state.
func (am *alertmanager) MergeState(state ExternalState) error {
	if err := am.Base.MergeNflog(state.Nflog); err != nil {
		return err
	}
	if err := am.Base.MergeSilences(state.Silences); err != nil {
		return err
	}
	return am.Base.MergeFlushLog(state.FlushLog)
}

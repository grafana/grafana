export type BaseAlertmanagerArgs = {
  /**
   * Name of alertmanager to use for config entity management
   *
   * Hooks will behave differently depending on whether this is `grafana` or an external alertmanager
   */
  alertmanager: string;
};

export type Skippable = {
  /**
   * Should we skip requests altogether?
   * Useful for cases where we want to conditionally call hook methods
   */
  skip?: boolean;
};

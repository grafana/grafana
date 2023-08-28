export const Messages = {
  pageTitleSelection: 'Inventory / Add service / Step 1 of 2',
  pageTitleConfiguration: 'Inventory / Add service / Step 2 of 2',
  selectionStep: {
    cancel: 'Cancel',
    next: 'Next step: Configuration',
  },
  configurationStep: {
    cancel: 'Cancel',
    next: 'Add service',
    discover: 'Discover',
  },
  form: {
    trackingOptions: {
      none: "Don't track",
      pgStatements: 'PG Stat Statements',
      pgMonitor: 'PG Stat Monitor',
    },
    schemaOptions: {
      http: 'HTTP',
      https: 'HTTPS',
    },
    metricsParametersOptions: {
      manually: 'Set manually',
      parsed: 'Parse from URL string',
    },
    buttons: {
      addService: 'Add service',
      toMenu: 'Return to menu',
    },
    titles: {
      addExternalService: 'Add external service',
      addRemoteInstance: 'Add remote instance',
    },
  },
  success: {
    title: (service: string) => `Service “${service}” added to your inventory`,
    description: (serviceType: string) => `Your ${serviceType} service instance is now ready to be monitored.`,
  },
};

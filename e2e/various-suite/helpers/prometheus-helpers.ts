export function getResources() {
  cy.intercept(/__name__/g, metricResponse);

  cy.intercept(/metadata/g, metadataResponse);

  cy.intercept(/labels/g, labelsResponse);
}

const metricResponse = {
  status: 'success',
  data: ['metric1', 'metric2'],
};

const metadataResponse = {
  status: 'success',
  data: {
    metric1: [
      {
        type: 'counter',
        help: 'metric1 help',
        unit: '',
      },
    ],
    metric2: [
      {
        type: 'counter',
        help: 'metric2 help',
        unit: '',
      },
    ],
  },
};

const labelsResponse = {
  status: 'success',
  data: ['__name__', 'action', 'active', 'backend'],
};

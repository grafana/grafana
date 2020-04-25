import { componentFactory } from '../../support';

export const QueryTab = componentFactory({
  selectors: {
    scenarioSelect: 'Test Data Query scenario select',
    max: 'TestData max',
    min: 'TestData min',
    noise: 'TestData noise',
    seriesCount: 'TestData series count',
    spread: 'TestData spread',
    startValue: 'TestData start value',
  },
});

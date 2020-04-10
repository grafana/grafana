import { componentFactory } from '../../../support';

export const TestDataQueryEditor = componentFactory({
  selectors: {
    max: 'TestData max',
    min: 'TestData min',
    noise: 'TestData noise',
    seriesCount: 'TestData series count',
    spread: 'TestData spread',
    startValue: 'TestData start value',
  },
});

import { generatePipelineVariableName } from './utils';

describe('generatePipelineVariableName', () => {
  it('Correctly generates a new name', () => {
    // when we have no previous name, the generated one should be `var1`
    expect(generatePipelineVariableName([])).toBe('var1');

    expect(
      generatePipelineVariableName([
        {
          name: 'var1',
          pipelineAgg: '',
        },
      ])
    ).toBe('var2');

    // It should only generate nemes based on variables named `var{n}`
    expect(
      generatePipelineVariableName([
        {
          name: 'something1',
          pipelineAgg: '',
        },
      ])
    ).toBe('var1');
  });
});

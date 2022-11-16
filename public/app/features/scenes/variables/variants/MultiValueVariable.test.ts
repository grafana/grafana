import { lastValueFrom, Observable, of } from 'rxjs';

import { VariableValueOption } from '../types';
import { MultiValueVariable, MultiValueVariableState, VariableGetOptionsArgs } from '../variants/MultiValueVariable';

export interface ExampleVariableState extends MultiValueVariableState {
  optionsToReturn: VariableValueOption[];
}

class ExampleVariable extends MultiValueVariable<ExampleVariableState> {
  public getValueOptions(args: VariableGetOptionsArgs): Observable<VariableValueOption[]> {
    return of(this.state.optionsToReturn);
  }
}

describe('MultiValueVariable', () => {
  describe('When validateAndUpdate is called', () => {
    it('Should pick first value if current value is not valid', async () => {
      const variable = new ExampleVariable({
        name: 'test',
        options: [],
        optionsToReturn: [
          { label: 'B', value: 'B' },
          { label: 'C', value: 'C' },
        ],
        value: 'A',
        text: 'A',
      });

      await lastValueFrom(variable.validateAndUpdate());

      expect(variable.state.value).toBe('B');
      expect(variable.state.text).toBe('B');
    });

    it('Should keep current value if current value is valid', async () => {
      const variable = new ExampleVariable({
        name: 'test',
        options: [],
        optionsToReturn: [{ label: 'A', value: 'A' }],
        value: 'A',
        text: 'A',
      });

      await lastValueFrom(variable.validateAndUpdate());

      expect(variable.state.value).toBe('A');
      expect(variable.state.text).toBe('A');
    });
  });
});

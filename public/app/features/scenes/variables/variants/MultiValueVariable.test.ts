import { lastValueFrom, Observable, of } from 'rxjs';

import { ALL_VARIABLE_TEXT, ALL_VARIABLE_VALUE } from 'app/features/variables/constants';

import { SceneVariableValueChangedEvent, VariableValueOption } from '../types';
import { MultiValueVariable, MultiValueVariableState, VariableGetOptionsArgs } from '../variants/MultiValueVariable';

export interface ExampleVariableState extends MultiValueVariableState {
  optionsToReturn: VariableValueOption[];
}

class ExampleVariable extends MultiValueVariable<ExampleVariableState> {
  public constructor(initialState: Partial<ExampleVariableState>) {
    super({
      type: 'custom',
      optionsToReturn: [],
      value: '',
      text: '',
      name: '',
      options: [],
      ...initialState,
    });
  }
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

    it('Should maintain the valid values when multiple selected', async () => {
      const variable = new ExampleVariable({
        name: 'test',
        options: [],
        isMulti: true,
        optionsToReturn: [
          { label: 'A', value: 'A' },
          { label: 'C', value: 'C' },
        ],
        value: ['A', 'B', 'C'],
        text: ['A', 'B', 'C'],
      });

      await lastValueFrom(variable.validateAndUpdate());

      expect(variable.state.value).toEqual(['A', 'C']);
      expect(variable.state.text).toEqual(['A', 'C']);
    });

    it('Should pick first option if none of the current values are valid', async () => {
      const variable = new ExampleVariable({
        name: 'test',
        options: [],
        isMulti: true,
        optionsToReturn: [
          { label: 'A', value: 'A' },
          { label: 'C', value: 'C' },
        ],
        value: ['D', 'E'],
        text: ['E', 'E'],
      });

      await lastValueFrom(variable.validateAndUpdate());

      expect(variable.state.value).toEqual(['A']);
      expect(variable.state.text).toEqual(['A']);
    });

    it('Should handle $__all value and send change event even when value is still $__all', async () => {
      const variable = new ExampleVariable({
        name: 'test',
        options: [],
        optionsToReturn: [
          { label: 'A', value: '1' },
          { label: 'B', value: '2' },
        ],
        value: ALL_VARIABLE_VALUE,
        text: ALL_VARIABLE_TEXT,
      });

      let changeEvent: SceneVariableValueChangedEvent | undefined;
      variable.subscribeToEvent(SceneVariableValueChangedEvent, (evt) => (changeEvent = evt));

      await lastValueFrom(variable.validateAndUpdate());

      expect(variable.state.value).toBe(ALL_VARIABLE_VALUE);
      expect(variable.state.text).toBe(ALL_VARIABLE_TEXT);
      expect(variable.state.options).toEqual(variable.state.optionsToReturn);
      expect(changeEvent).toBeDefined();
    });
  });

  describe('getValue and getValueText', () => {
    it('GetValueText should return text', async () => {
      const variable = new ExampleVariable({
        name: 'test',
        options: [],
        optionsToReturn: [],
        value: '1',
        text: 'A',
      });

      expect(variable.getValue()).toBe('1');
      expect(variable.getValueText()).toBe('A');
    });

    it('GetValueText should return All text when value is $__all', async () => {
      const variable = new ExampleVariable({
        name: 'test',
        options: [],
        optionsToReturn: [],
        value: ALL_VARIABLE_VALUE,
        text: 'A',
      });

      expect(variable.getValueText()).toBe(ALL_VARIABLE_TEXT);
    });

    it('GetValue should return all options as an array when value is $__all', async () => {
      const variable = new ExampleVariable({
        name: 'test',
        options: [
          { label: 'A', value: '1' },
          { label: 'B', value: '2' },
        ],
        optionsToReturn: [],
        value: ALL_VARIABLE_VALUE,
        text: 'A',
      });

      expect(variable.getValue()).toEqual(['1', '2']);
    });
  });

  describe('Url syncing', () => {
    it('getUrlState should return single value state if value is single value', async () => {
      const variable = new ExampleVariable({
        name: 'test',
        options: [],
        optionsToReturn: [],
        value: '1',
        text: 'A',
      });

      expect(variable.urlSync?.getUrlState(variable.state)).toEqual({ ['var-test']: '1' });
    });

    it('getUrlState should return string array if value is string array', async () => {
      const variable = new ExampleVariable({
        name: 'test',
        options: [],
        optionsToReturn: [],
        value: ['1', '2'],
        text: ['A', 'B'],
      });

      expect(variable.urlSync?.getUrlState(variable.state)).toEqual({ ['var-test']: ['1', '2'] });
    });

    it('fromUrlState should update value for single value', async () => {
      const variable = new ExampleVariable({
        name: 'test',
        options: [
          { label: 'A', value: '1' },
          { label: 'B', value: '2' },
        ],
        optionsToReturn: [],
        value: '1',
        text: 'A',
      });

      variable.urlSync?.updateFromUrl({ ['var-test']: '2' });
      expect(variable.state.value).toEqual('2');
      expect(variable.state.text).toEqual('B');
    });

    it('fromUrlState should update value for array value', async () => {
      const variable = new ExampleVariable({
        name: 'test',
        options: [
          { label: 'A', value: '1' },
          { label: 'B', value: '2' },
        ],
        optionsToReturn: [],
        value: '1',
        text: 'A',
      });

      variable.urlSync?.updateFromUrl({ ['var-test']: ['2', '1'] });
      expect(variable.state.value).toEqual(['2', '1']);
      expect(variable.state.text).toEqual(['B', 'A']);
    });
  });
});

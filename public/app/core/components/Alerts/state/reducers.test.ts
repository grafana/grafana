import { alertsReducer } from './reducers';
import { ActionTypes } from './actions';

describe('clear alert', () => {
  it('should filter alert', () => {
    const initialState = {
      alerts: [
        {
          severity: 'success',
          icon: 'success',
          title: 'test',
          text: 'test alert',
        },
        {
          severity: 'fail',
          icon: 'warning',
          title: 'test2',
          text: 'test alert fail 2',
        },
      ],
    };

    const result = alertsReducer(initialState, {
      type: ActionTypes.ClearAlert,
      payload: initialState.alerts[1],
    });

    const expectedResult = {
      alerts: [
        {
          severity: 'success',
          icon: 'success',
          title: 'test',
          text: 'test alert',
        },
      ],
    };

    expect(result).toEqual(expectedResult);
  });
});

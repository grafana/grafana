import { GrafanaAction, GrafanaActionCreator } from './actionCreatorFactory';
import { Reducer } from 'redux';

export interface ActionHandler<State, Payload> {
  state: State;
  action: GrafanaAction<Payload>;
}

export interface ActionHandlerConfig<State, Payload> {
  creator: GrafanaActionCreator<Payload>;
  handler: (handler: ActionHandler<State, Payload>) => State;
}

export interface AddActionHandler<State> {
  addHandler: <Payload>(config: ActionHandlerConfig<State, Payload>) => CreateReducer<State>;
}

export interface CreateReducer<State> extends AddActionHandler<State> {
  create: () => Reducer<State, GrafanaAction<any>>;
}

export const reducerFactory = <State>(initialState: State): AddActionHandler<State> => {
  const allHandlerConfigs: Array<ActionHandlerConfig<State, any>> = [];

  const addHandler = <Payload>(config: ActionHandlerConfig<State, Payload>): CreateReducer<State> => {
    if (allHandlerConfigs.some(c => c.creator.type === config.creator.type)) {
      throw new Error(`There is already a handlers defined with the type ${config.creator.type}`);
    }

    allHandlerConfigs.push(config);

    return instance;
  };

  const create = (): Reducer<State, GrafanaAction<any>> => {
    const reducer: Reducer<State, GrafanaAction<any>> = (state: State = initialState, action: GrafanaAction<any>) => {
      const validHandlers = allHandlerConfigs
        .filter(config => config.creator.type === action.type)
        .map(config => config.handler);

      return validHandlers.reduce((currentState, handler) => {
        return handler({ state: currentState, action });
      }, state || initialState);
    };

    return reducer;
  };

  const instance: CreateReducer<State> = {
    addHandler,
    create,
  };

  return instance;
};

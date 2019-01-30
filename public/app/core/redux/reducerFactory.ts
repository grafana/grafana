import { GrafanaAction, GrafanaActionCreator } from './actionCreatorFactory';
import { Reducer } from 'redux';

export interface HandlerConfig<State, Payload> {
  filter: GrafanaActionCreator<Payload>;
  handler: (state: State, action: GrafanaAction<Payload>) => State;
}

export interface AddHandler<State> {
  addHandler: <Payload>(config: HandlerConfig<State, Payload>) => CreateReducer<State>;
}

export interface CreateReducer<State> extends AddHandler<State> {
  create: () => Reducer<State, GrafanaAction<any>>;
}

export const reducerFactory = <State>(initialState: State): AddHandler<State> => {
  const allHandlerConfigs: Array<HandlerConfig<State, any>> = [];

  const addHandler = <Payload>(config: HandlerConfig<State, Payload>): CreateReducer<State> => {
    if (allHandlerConfigs.some(c => c.filter.type === config.filter.type)) {
      throw new Error(`There is already a handlers defined with the type ${config.filter.type}`);
    }

    allHandlerConfigs.push(config);

    return instance;
  };

  const create = (): Reducer<State, GrafanaAction<any>> => {
    const reducer: Reducer<State, GrafanaAction<any>> = (state: State = initialState, action: GrafanaAction<any>) => {
      const validHandlers = allHandlerConfigs
        .filter(config => config.filter.type === action.type)
        .map(config => config.handler);

      return validHandlers.reduce((currentState, handler) => {
        return handler(currentState, action);
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

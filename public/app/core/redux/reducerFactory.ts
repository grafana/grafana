import { ActionOf, ActionCreator } from './actionCreatorFactory';

export type Mapper<State, Payload> = (state: State, action: ActionOf<Payload>) => State;

export interface HandlerConfig<State, Payload> {
  filter: ActionCreator<Payload>;
  mapper: Mapper<State, Payload>;
}

export interface AddHandler<State> {
  addHandler: <Payload>(config: HandlerConfig<State, Payload>) => CreateReducer<State>;
}

export interface CreateReducer<State> extends AddHandler<State> {
  create: () => Mapper<State, any>;
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

  const create = () => (state: State = initialState, action: ActionOf<any>): State => {
    const handlerConfig = allHandlerConfigs.filter(config => config.filter.type === action.type)[0];

    if (handlerConfig) {
      return handlerConfig.mapper(state, action);
    }

    return state;
  };

  const instance: CreateReducer<State> = {
    addHandler,
    create,
  };

  return instance;
};

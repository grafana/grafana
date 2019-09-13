import { ActionOf, ActionCreator } from './actionCreatorFactory';
import { Reducer } from 'redux';
import { locationChanged, LocationChanged } from '../actions/location';

export type Mapper<State, Payload> = (state: State, action: ActionOf<Payload>) => State;

export interface MapperConfig<State, Payload> {
  filter: ActionCreator<Payload>;
  mapper: Mapper<State, Payload>;
}

export interface AddMapper<State> {
  addMapper: <Payload>(config: MapperConfig<State, Payload>) => CreateReducer<State>;
}

export interface CreateReducer<State> extends AddMapper<State> {
  create: (config?: { resetStateForPath: string }) => Reducer<State, ActionOf<any>>;
}

export const reducerFactory = <State>(initialState: State): AddMapper<State> => {
  const allMappers: { [key: string]: Mapper<State, any> } = {};

  const addMapper = <Payload>(config: MapperConfig<State, Payload>): CreateReducer<State> => {
    if (allMappers[config.filter.type]) {
      throw new Error(`There is already a mapper defined with the type ${config.filter.type}`);
    }

    allMappers[config.filter.type] = config.mapper;

    return instance;
  };

  const create = (config?: { resetStateForPath: string }): Reducer<State, ActionOf<any>> => (
    state: State = initialState,
    action: ActionOf<any>
  ): State => {
    if (config && action.type === locationChanged.type) {
      const { resetStateForPath } = config;
      const { fromPath, toPath } = action.payload as LocationChanged;
      if (resetStateForPath && resetStateForPath === fromPath && toPath.indexOf(fromPath) === -1) {
        return initialState;
      }
    }

    const mapper = allMappers[action.type];

    if (mapper) {
      return mapper(state, action);
    }

    return state;
  };

  const instance: CreateReducer<State> = { addMapper, create };

  return instance;
};

import { ActionOf, ActionCreator } from './actionCreatorFactory';
import { Reducer } from 'redux';

export type Mapper<State, Payload> = (state: State, action: ActionOf<Payload>) => State;

export interface MapperConfig<State, Payload> {
  filter: ActionCreator<Payload>;
  mapper: Mapper<State, Payload>;
}

export interface AddMapper<State> {
  addMapper: <Payload>(config: MapperConfig<State, Payload>) => CreateReducer<State>;
}

export interface CreateReducer<State> extends AddMapper<State> {
  create: () => Reducer<State, ActionOf<any>>;
}

export const reducerFactory = <State>(initialState: State): AddMapper<State> => {
  const allMapperConfigs: Array<MapperConfig<State, any>> = [];

  const addMapper = <Payload>(config: MapperConfig<State, Payload>): CreateReducer<State> => {
    if (allMapperConfigs.some(c => c.filter.type === config.filter.type)) {
      throw new Error(`There is already a Mappers defined with the type ${config.filter.type}`);
    }

    allMapperConfigs.push(config);

    return instance;
  };

  const create = (): Reducer<State, ActionOf<any>> => (state: State = initialState, action: ActionOf<any>): State => {
    const mapperConfig = allMapperConfigs.filter(config => config.filter.type === action.type)[0];

    if (mapperConfig) {
      return mapperConfig.mapper(state, action);
    }

    return state;
  };

  const instance: CreateReducer<State> = { addMapper, create };

  return instance;
};

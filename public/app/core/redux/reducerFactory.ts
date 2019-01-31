import { ActionOf, ActionCreator, actionCreatorFactory } from './actionCreatorFactory';
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

/** Another type of fluent reducerFactory */

export interface FilterWith<State> {
  filterWith: <Payload>(actionCreator: ActionCreator<Payload>) => MapTo<State, Payload>;
}

export interface OrFilterWith<State> {
  orFilterWith: <Payload>(actionCreator: ActionCreator<Payload>) => MapTo<State, Payload>;
}

export interface MapTo<State, Payload> {
  mapTo: (mapper: Mapper<State, Payload>) => CreateReducerEx<State>;
}

export interface CreateReducerEx<State> extends OrFilterWith<State> {
  create: () => Reducer<State, ActionOf<any>>;
}

export const reducerFactoryEx = <State>(initialState: State): FilterWith<State> => {
  const allMapperConfigs: Array<MapperConfig<State, any>> = [];

  const innerMapTo = (actionCreator: ActionCreator<any>, mapper: Mapper<State, any>): CreateReducerEx<State> => {
    allMapperConfigs.filter(config => config.filter.type === actionCreator.type)[0].mapper = mapper;

    return instance;
  };

  const filterWith = <Payload>(actionCreator: ActionCreator<Payload>): MapTo<State, Payload> => {
    if (allMapperConfigs.some(c => c.filter.type === actionCreator.type)) {
      throw new Error(`There is already a mapper defined with the type ${actionCreator.type}`);
    }

    allMapperConfigs.push({ filter: actionCreator, mapper: null });

    const mapTo = <Payload>(mapper: Mapper<State, Payload>): CreateReducerEx<State> => {
      innerMapTo(actionCreator, mapper);

      return instance;
    };

    return { mapTo };
  };

  const orFilterWith = <Payload>(actionCreator: ActionCreator<Payload>): MapTo<State, Payload> => {
    if (allMapperConfigs.some(c => c.filter.type === actionCreator.type)) {
      throw new Error(`There is already a mapper defined with the type ${actionCreator.type}`);
    }

    allMapperConfigs.push({ filter: actionCreator, mapper: null });

    const mapTo = <Payload>(mapper: Mapper<State, Payload>): CreateReducerEx<State> => {
      innerMapTo(actionCreator, mapper);

      return instance;
    };

    return { mapTo };
  };

  const create = (): Reducer<State, ActionOf<any>> => (state: State = initialState, action: ActionOf<any>): State => {
    const mapperConfig = allMapperConfigs.filter(config => config.filter.type === action.type)[0];

    if (mapperConfig) {
      return mapperConfig.mapper(state, action);
    }

    return state;
  };

  const instance = { filterWith, orFilterWith, create };

  return instance;
};

interface TestState {
  data: string[];
}

const initialState: TestState = {
  data: [],
};

const dummyActionCreator = actionCreatorFactory<string>('dummyActionCreator').create();
const dummyActionCreator2 = actionCreatorFactory<number>('dummyActionCreator2').create();

export const reducerFactoryExReducer = reducerFactoryEx<TestState>(initialState)
  .filterWith(dummyActionCreator)
  .mapTo((state, action) => ({ ...state, data: state.data.concat(action.payload) }))
  .orFilterWith(dummyActionCreator2)
  .mapTo((state, action) => ({ ...state, data: state.data.concat(`${action.payload}`) }))
  .create();

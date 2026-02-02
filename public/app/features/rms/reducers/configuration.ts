import { ConfigAction, GEN_ERR, LOAD_END, UPDATE_PLATFORM_URL } from './actionTypes';

export interface ConfigState {
  loading: boolean;
  initialLoading: boolean;
  genErr?: string;
  platformURL?: string;
}

export const configState: ConfigState = {
  loading: true,
  initialLoading: true,
};

export const configReducer = (state: ConfigState, action: ConfigAction) => {
  switch (action.type) {
    case GEN_ERR:
      return { ...state, genErr: action.payload, loading: false, initialLoading: false };
    case LOAD_END:
      return { ...state, loading: false, initialLoading: false };
    case UPDATE_PLATFORM_URL:
      return { ...state, platformURL: action.payload };
    default:
      return state;
  }
};

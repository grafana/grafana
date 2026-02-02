import React, { useEffect } from 'react';
import { Action } from 'redux';

import { t } from 'app/core/internationalization';
import { calcFieldsSrv } from 'app/core/services/calcFields_srv';

import { GEN_ERR, LOAD_END, UPDATE_PLATFORM_URL } from '../reducers/actionTypes';
import { configReducer, configState, ConfigState } from '../reducers/configuration';

export interface ReducerAction extends Action {
  payload?: any;
}

export const RMSContext = React.createContext<
  { state: ConfigState; dispatch: React.Dispatch<ReducerAction> } | undefined
>(undefined);

export const RMSContextProvider = (props: { initialState: ConfigState; children: React.ReactNode }) => {
  const { initialState = {}, ...trimmedProps } = props;
  const [state, dispatch] = React.useReducer(configReducer, configState);

  useEffect(() => {
    const bmcHelixDS = calcFieldsSrv.getPlatformUrl();
    const platformURL = (bmcHelixDS?.jsonData as any)?.platformURL ?? '';
    if (!platformURL) {
      dispatch({
        type: GEN_ERR,
        payload: t('bmc.calc-fields.connection-error', 'Connectivity to BMC Helix ITSM is not configured.'),
      });
    } else {
      dispatch({ type: LOAD_END });
      dispatch({ type: UPDATE_PLATFORM_URL, payload: platformURL });
    }
  }, []);

  return <RMSContext.Provider value={{ state, dispatch }} {...trimmedProps} />;
};

export const useMyContext = () => {
  const context = React.useContext(RMSContext);
  if (!context) {
    throw new Error('useMyContext must be used within a MyProvider');
  }
  return context;
};

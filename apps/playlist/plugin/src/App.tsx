import * as React from 'react';
import { AppRootProps } from '@grafana/data';
import { PluginPropsContext } from 'utils/utils.plugin';
import { Routes } from 'components/Routes';
import { JsonData } from './types';

export const App = (props: AppRootProps<JsonData>) => {
    return (
        <PluginPropsContext.Provider value={props}>
            <Routes />
        </PluginPropsContext.Provider>
    );
};

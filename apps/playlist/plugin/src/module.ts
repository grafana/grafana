import { AppPlugin, AppRootProps } from '@grafana/data';
import { ComponentClass } from 'react';
import { App } from './App';

export const plugin = new AppPlugin().setRootPage(App as unknown as ComponentClass<AppRootProps>);

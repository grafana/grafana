import { ComponentClass } from 'react';

import { AppPlugin, AppRootProps } from '@grafana/data';
import { MarketplaceRootPage } from './RootPage';

export const plugin = new AppPlugin().setRootPage((MarketplaceRootPage as unknown) as ComponentClass<AppRootProps>);

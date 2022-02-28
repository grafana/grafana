import React, { FC } from 'react';
import { PlatformProps } from './types';
import { Connected } from './Connected/Connected';
import { Connect } from './Connect/Connect';

export const Platform: FC<PlatformProps> = ({ isConnected }) => (isConnected ? <Connected /> : <Connect />);

import React, { FC } from 'react';

import { IconProps } from '../DBIcon.types';

export const Cancel: FC<React.PropsWithChildren<IconProps>> = ({ size = 22, ...rest }) => (
  <svg width={size} height={size} viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg" {...rest}>
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M17.5217 4.47826C17.5217 6.39913 13.8226 7.95652 9.26087 7.95652C4.69913 7.95652 1 6.39913 1 4.47826C1 2.55739 4.69913 1 9.26087 1C13.8226 1 17.5217 2.55739 17.5217 4.47826V4.47826Z"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M10.5652 11.3906C10.14 11.4193 9.70435 11.4349 9.26087 11.4349C4.69913 11.4349 1 9.87754 1 7.95667"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M9.26087 15.3478C4.69913 15.3478 1 13.7904 1 11.8695"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M9.26087 19.2609C4.69913 19.2609 1 17.7035 1 15.7826V4.47827"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path d="M17.5215 4.47827V9.26088" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M20.9998 21H11.4346L16.2172 11.4348L20.9998 21V21Z"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path d="M16.2178 15.3478V17.9565" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M16.217 18.826C15.977 18.826 15.7822 19.02 15.7822 19.2608C15.7822 19.5 15.977 19.6956 16.217 19.6956C16.457 19.6956 16.6518 19.5 16.6518 19.2608C16.6518 19.02 16.457 18.826 16.217 18.826Z"
      fill="black"
    />
  </svg>
);

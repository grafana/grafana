import React, { FC } from 'react';

import { IconProps } from '../DBIcon.types';

export const Delete: FC<React.PropsWithChildren<IconProps>> = ({ size = 22, ...rest }) => (
  <svg width={size} height={size} viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg" {...rest}>
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M21.0002 15.7823C21.0002 18.6641 18.6637 20.9997 15.7828 20.9997C12.9011 20.9997 10.5654 18.6641 10.5654 15.7823C10.5654 12.9006 12.9011 10.5649 15.7828 10.5649C18.6637 10.5649 21.0002 12.9006 21.0002 15.7823V15.7823Z"
      stroke="currentColor"
      strokeLinejoin="round"
    />
    <path d="M13.6309 17.9342L17.9352 13.6316" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M17.9352 17.9342L13.6309 13.6316" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M17.5217 4.49913C17.5217 6.41739 13.8226 7.97739 9.26087 7.97739C4.69913 7.97739 1 6.41739 1 4.49913C1 2.57739 4.69913 1 9.26087 1C13.8226 1 17.5217 2.57739 17.5217 4.49913V4.49913Z"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M9.26087 11.4556C4.69913 11.4556 1 9.89556 1 7.97729"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M7.95652 15.324C4.01478 15.0606 1 13.6214 1 11.8901"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M8.3913 19.2606C4.23826 19.0789 1 17.6006 1 15.8032V4.47803"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path d="M17.5215 4.47803V8.39107" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

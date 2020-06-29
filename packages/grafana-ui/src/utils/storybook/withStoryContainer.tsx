import React from 'react';
import { boolean, number } from '@storybook/addon-knobs';
import { css, cx } from 'emotion';
import { RenderFunction } from '../../types';

const StoryContainer: React.FC<{ width?: number; height?: number; showBoundaries: boolean }> = ({
  children,
  width,
  height,
  showBoundaries,
}) => {
  const checkColor = '#f0f0f0';
  const finalWidth = width ? `${width}px` : '100%';
  const finalHeight = height !== 0 ? `${height}px` : 'auto';
  const bgStyles =
    showBoundaries &&
    css`
      background-color: white;
      background-size: 30px 30px;
      background-position: 0 0, 15px 15px;
      background-image: linear-gradient(
          45deg,
          ${checkColor} 25%,
          transparent 25%,
          transparent 75%,
          ${checkColor} 75%,
          ${checkColor}
        ),
        linear-gradient(45deg, ${checkColor} 25%, transparent 25%, transparent 75%, ${checkColor} 75%, ${checkColor});
    `;
  return (
    <div
      className={cx(
        css`
          width: ${finalWidth};
          height: ${finalHeight};
        `,
        bgStyles
      )}
    >
      {children}
    </div>
  );
};

export const withStoryContainer = (story: RenderFunction) => {
  const CONTAINER_GROUP = 'Container options';
  // ---
  const containerBoundary = boolean('Show container boundary', false, CONTAINER_GROUP);
  const fullWidthContainer = boolean('Full width container', false, CONTAINER_GROUP);
  const containerWidth = number(
    'Container width',
    300,
    {
      range: true,
      min: 100,
      max: 500,
      step: 10,
    },
    CONTAINER_GROUP
  );
  const containerHeight = number(
    'Container height',
    0,
    {
      range: true,
      min: 100,
      max: 500,
      step: 10,
    },
    CONTAINER_GROUP
  );
  return (
    <StoryContainer
      width={fullWidthContainer ? undefined : containerWidth}
      height={containerHeight}
      showBoundaries={containerBoundary}
    >
      {story()}
    </StoryContainer>
  );
};

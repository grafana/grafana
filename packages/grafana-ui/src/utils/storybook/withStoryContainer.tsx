import React from 'react';
import { boolean, number } from '@storybook/addon-knobs';
import { css, cx } from 'emotion';
import { RenderFunction } from '../../types';

export const StoryContainer = React.forwardRef<
  HTMLDivElement,
  { width?: number; height?: number; showBoundaries: boolean; className?: string; children: React.ReactNode }
>(({ children, width, height, showBoundaries, className }, ref) => {
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
      ref={ref}
      className={cx(
        css`
          width: ${finalWidth};
          height: ${finalHeight};
        `,
        bgStyles,
        className
      )}
    >
      {children}
    </div>
  );
});
export const CONTAINER_GROUP = 'Container options';
export const withStoryContainer = (story: RenderFunction) => {
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

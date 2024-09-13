import { css, cx } from '@emotion/css';
import { Args, Decorator } from '@storybook/react';
import * as React from 'react';

interface Props {
  width?: number;
  height?: number;
  showBoundaries: boolean;
}

const StoryContainer = ({ width, height, showBoundaries, children }: React.PropsWithChildren<Props>) => {
  const checkColor = '#f0f0f0';
  const finalWidth = width ? `${width}px` : '100%';
  const finalHeight = height !== 0 ? `${height}px` : 'auto';
  const bgStyles =
    showBoundaries &&
    css({
      backgroundColor: 'white',
      backgroundSize: '30px 30px',
      backgroundPosition: '0 0, 15px 15px',
      backgroundImage: `linear-gradient(
          45deg,
          ${checkColor} 25%,
          transparent 25%,
          transparent 75%,
          ${checkColor} 75%,
          ${checkColor}
        ),
        linear-gradient(45deg, ${checkColor} 25%, transparent 25%, transparent 75%, ${checkColor} 75%, ${checkColor})`,
    });
  return (
    <div
      className={cx(
        css({
          width: finalWidth,
          height: finalHeight,
        }),
        bgStyles
      )}
    >
      {children}
    </div>
  );
};

export const withStoryContainer: Decorator<Args> = (story, { args }) => {
  return (
    <StoryContainer width={args.containerWidth} height={args.containerHeight} showBoundaries={args.showBoundaries}>
      {story()}
    </StoryContainer>
  );
};

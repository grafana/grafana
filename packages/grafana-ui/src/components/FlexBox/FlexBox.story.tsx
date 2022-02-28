import React from 'react';
import { FlexBox } from './FlexBox';
import { withCenteredStory } from '@grafana/ui/src/utils/storybook/withCenteredStory';
import mdx from './FlexBox.mdx';
import { useTheme2 } from '../../themes/ThemeContext';

export default {
  title: 'Layout/FlexBox',
  component: FlexBox,
  decorators: [withCenteredStory],
  parameters: {
    docs: {
      page: mdx,
    },
  },
};

export const Examples = () => {
  const theme = useTheme2();

  function RedBox({ children, minHeight = 50 }: any) {
    return <div style={{ background: theme.colors.error.main, minWidth: 50, minHeight }}>{children}</div>;
  }

  return (
    <FlexBox direction="column">
      <span>Defaults</span>
      <FlexBox>
        <RedBox />
        <RedBox />
        <RedBox />
      </FlexBox>
      <span>Direction = column, gap=0.5</span>
      <FlexBox direction="column" gap={0.5}>
        <RedBox />
        <RedBox />
        <RedBox />
      </FlexBox>
      <span>alignItems=center</span>
      <FlexBox alignItems="center">
        <RedBox />
        <RedBox minHeight={10} />
        <RedBox minHeight={20} />
      </FlexBox>
      <span>justifyContent=flex-end</span>
      <FlexBox justifyContent="flex-end">
        <RedBox />
      </FlexBox>
    </FlexBox>
  );
};

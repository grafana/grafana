import React, { FC } from 'react';
import { TagList } from '@grafana/ui';
import { Matcher } from 'app/plugins/datasource/alertmanager/types';
import { matcherToOperator } from '../../utils/alertmanager';

type MatchersProps = { matchers: Matcher[] };

export const Matchers: FC<MatchersProps> = ({ matchers }) => {
  return (
    <div>
      <TagList tags={matchers.map((matcher) => `${matcher.name}${matcherToOperator(matcher)}${matcher.value}`)} />
    </div>
  );
};

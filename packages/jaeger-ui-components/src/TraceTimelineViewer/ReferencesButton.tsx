// Copyright (c) 2019 The Jaeger Authors.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import React from 'react';
import { css } from '@emotion/css';
import { Tooltip, useStyles2 } from '@grafana/ui';

import { TraceSpanReference } from '../types/trace';
import ReferenceLink from '../url/ReferenceLink';

export const getStyles = () => {
  return {
    MultiParent: css`
      padding: 0 5px;
      & ~ & {
        margin-left: 5px;
      }
    `,
    TraceRefLink: css`
      display: flex;
      justify-content: space-between;
    `,
    NewWindowIcon: css`
      margin: 0.2em 0 0;
    `,
    tooltip: css`
      max-width: none;
    `,
  };
};

type TReferencesButtonProps = {
  references: TraceSpanReference[];
  children: React.ReactNode;
  tooltipText: string;
  focusSpan: (spanID: string) => void;
};

const ReferencesButton = (props: TReferencesButtonProps) => {
  const { references, children, tooltipText, focusSpan } = props;
  const styles = useStyles2(getStyles);

  // TODO: handle multiple items with some dropdown
  const ref = references[0];
  return (
    <Tooltip content={tooltipText}>
      <ReferenceLink reference={ref} focusSpan={focusSpan} className={styles.MultiParent}>
        {children}
      </ReferenceLink>
    </Tooltip>
  );
};

export default ReferencesButton;

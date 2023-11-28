// Copyright (c) 2017 Uber Technologies, Inc.
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
import { css } from '@emotion/css';
import cx from 'classnames';
import * as React from 'react';
import { useStyles2 } from '@grafana/ui';
import { FALLBACK_TRACE_NAME } from '../constants';
import BreakableText from './BreakableText';
const getStyles = (theme) => {
    return {
        TraceName: css `
      label: TraceName;
      font-size: ${theme.typography.size.lg};
    `,
    };
};
export default function TraceName(props) {
    const { className, traceName } = props;
    const styles = useStyles2(getStyles);
    const text = String(traceName || FALLBACK_TRACE_NAME);
    const title = React.createElement(BreakableText, { text: text });
    return React.createElement("span", { className: cx(styles.TraceName, className) }, title);
}
//# sourceMappingURL=TraceName.js.map
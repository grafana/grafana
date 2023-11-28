import { css } from '@emotion/css';
import React from 'react';
import { useStyles2 } from '@grafana/ui';
import { DataSourcesInfo } from './DataSourcesInfo';
export function SectionSubheader({ children, datasources, }) {
    const styles = useStyles2(getStyles);
    return (React.createElement("div", { className: styles.container },
        children,
        datasources && React.createElement(DataSourcesInfo, { datasources: datasources })));
}
const getStyles = (theme) => ({
    container: css({
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'space-between',
    }),
});
//# sourceMappingURL=SectionSubheader.js.map
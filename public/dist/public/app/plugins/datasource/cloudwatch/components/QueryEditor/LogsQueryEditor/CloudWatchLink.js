import React, { useEffect, useState } from 'react';
import { usePrevious } from 'react-use';
import { Icon } from '@grafana/ui';
import { encodeUrl } from '../../../aws_url';
export function CloudWatchLink({ panelData, query, datasource }) {
    const [href, setHref] = useState('');
    const prevPanelData = usePrevious(panelData);
    useEffect(() => {
        var _a, _b, _c, _d;
        if (prevPanelData !== panelData && ((_a = panelData === null || panelData === void 0 ? void 0 : panelData.request) === null || _a === void 0 ? void 0 : _a.range)) {
            const arns = ((_b = query.logGroups) !== null && _b !== void 0 ? _b : [])
                .filter((group) => group === null || group === void 0 ? void 0 : group.arn)
                .map((group) => { var _a; return ((_a = group.arn) !== null && _a !== void 0 ? _a : '').replace(/:\*$/, ''); }); // remove `:*` from end of arn
            const logGroupNames = query.logGroupNames;
            let sources = (arns === null || arns === void 0 ? void 0 : arns.length) ? arns : logGroupNames;
            const range = (_c = panelData === null || panelData === void 0 ? void 0 : panelData.request) === null || _c === void 0 ? void 0 : _c.range;
            const start = range.from.toISOString();
            const end = range.to.toISOString();
            const urlProps = {
                end,
                start,
                timeType: 'ABSOLUTE',
                tz: 'UTC',
                editorString: (_d = query.expression) !== null && _d !== void 0 ? _d : '',
                isLiveTail: false,
                source: sources !== null && sources !== void 0 ? sources : [],
            };
            setHref(encodeUrl(urlProps, datasource.resources.getActualRegion(query.region)));
        }
    }, [panelData, prevPanelData, datasource, query]);
    return (React.createElement("a", { href: href, target: "_blank", rel: "noopener noreferrer" },
        React.createElement(Icon, { name: "share-alt" }),
        " CloudWatch Logs Insights"));
}
//# sourceMappingURL=CloudWatchLink.js.map
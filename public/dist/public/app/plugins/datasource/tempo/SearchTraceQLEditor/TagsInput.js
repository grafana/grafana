import { css } from '@emotion/css';
import React, { useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { AccessoryButton } from '@grafana/experimental';
import { useStyles2 } from '@grafana/ui';
import { TraceqlSearchScope } from '../dataquery.gen';
import SearchField from './SearchField';
import { getFilteredTags } from './utils';
const getStyles = () => ({
    vertical: css `
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  `,
    horizontal: css `
    display: flex;
    flex-direction: row;
    gap: 1rem;
  `,
});
const TagsInput = ({ updateFilter, deleteFilter, filters, datasource, setError, staticTags, isTagsLoading, hideValues, query, }) => {
    const styles = useStyles2(getStyles);
    const generateId = () => uuidv4().slice(0, 8);
    const handleOnAdd = useCallback(() => updateFilter({ id: generateId(), operator: '=', scope: TraceqlSearchScope.Span }), [updateFilter]);
    useEffect(() => {
        if (!(filters === null || filters === void 0 ? void 0 : filters.length)) {
            handleOnAdd();
        }
    }, [filters, handleOnAdd]);
    const getTags = (f) => {
        const tags = datasource.languageProvider.getTags(f.scope);
        return getFilteredTags(tags, staticTags);
    };
    return (React.createElement("div", { className: styles.vertical }, filters === null || filters === void 0 ? void 0 : filters.map((f, i) => (React.createElement("div", { className: styles.horizontal, key: f.id },
        React.createElement(SearchField, { filter: f, datasource: datasource, setError: setError, updateFilter: updateFilter, tags: getTags(f), isTagsLoading: isTagsLoading, deleteFilter: deleteFilter, allowDelete: true, hideValue: hideValues, query: query }),
        i === filters.length - 1 && (React.createElement(AccessoryButton, { variant: 'secondary', icon: 'plus', onClick: handleOnAdd, title: 'Add tag' })))))));
};
export default TagsInput;
//# sourceMappingURL=TagsInput.js.map
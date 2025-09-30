import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, Dropdown, useStyles2 } from "@grafana/ui";
import { TagFilter } from 'app/core/components/TagFilter/TagFilter';

import { useSearchStateManager } from '../../search/state/SearchStateManager';

interface FilterTagProps {
  onTagsChange?: (tags: string[]) => void;
}

export const FilterTag = ({ onTagsChange }: FilterTagProps) => {
    const styles = useStyles2(getStyles);
    const [searchState, stateManager] = useSearchStateManager();

    const handleTagChange = (tags: string[]) => {
        stateManager.onTagFilterChange(tags);
        onTagsChange?.(tags);
    };

    const renderTagFilterDropdown = () => (
        <div className={styles.dropdownContent}>
            <TagFilter
                isClearable={true}
                tags={searchState.tag}
                tagOptions={stateManager.getTagOptions}
                onChange={handleTagChange}
                placeholder="Filter by tag"
                allowCustomValue={false}
                width={300}
            />
        </div>
    );

    return (
        <div className={styles.container}>
            <Dropdown 
                overlay={renderTagFilterDropdown} 
                placement="bottom-start"
            >
                <Button 
                    variant="secondary" 
                    icon="tag-alt"
                    className={styles.filterButton}
                >
                    Filter by tag
                    {searchState.tag.length > 0 && (
                        <span className={styles.tagCount}>({searchState.tag.length})</span>
                    )}
                </Button>
            </Dropdown>
        </div>
    );
};

const getStyles = (theme: GrafanaTheme2) => ({
    container: css({
        display: 'inline-block',
    }),

    filterButton: css({
        display: 'flex',
        alignItems: 'center',
        gap: theme.spacing(1),
    }),

    tagCount: css({
        fontSize: theme.typography.bodySmall.fontSize,
        fontWeight: theme.typography.fontWeightBold,
        color: theme.colors.primary.main,
        marginLeft: theme.spacing(0.5),
    }),

    dropdownContent: css({
        padding: theme.spacing(1),
        maxWidth: '320px',
        minWidth: '320px',
        backgroundColor: theme.colors.background.primary,
        border: `1px solid ${theme.colors.border.medium}`,
        borderRadius: theme.shape.radius.default,
        boxShadow: theme.shadows.z3,
    }),
});

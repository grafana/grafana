import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, Dropdown, useStyles2, Icon, Text } from "@grafana/ui";
import { TagFilter } from 'app/core/components/TagFilter/TagFilter';

import { useSearchStateManager } from '../../search/state/SearchStateManager';

interface FilterTagProps {
  onTagsChange?: (tags: string[]) => void;
}

export const FilterTag = ({ onTagsChange }: FilterTagProps) => {
    const styles = useStyles2(getStyles);
    const [searchState, stateManager] = useSearchStateManager();
    
    const hasActiveTags = searchState.tag.length > 0;

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
                placeholder="Search tags..."
                allowCustomValue={false}
                width={300}
            />
            <div className={styles.helpText}>
                <Icon name="info-circle" size="sm" />
                <Text variant="bodySmall" color="secondary">
                    Tags help organize dashboards. Add tags to your dashboards to enable filtering here.
                </Text>
            </div>
        </div>
    );

    return (
        <div className={styles.container}>
            <Dropdown 
                overlay={renderTagFilterDropdown} 
                placement="bottom-start"
            >
                <Button 
                    variant={hasActiveTags ? 'primary' : 'secondary'}
                    icon="tag-alt"
                    className={`${styles.filterButton} ${hasActiveTags ? styles.activeButton : ''}`}
                >
                    Filter by tag
                    {hasActiveTags && (
                        <span className={styles.tagCount}>{searchState.tag.length}</span>
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
        minHeight: theme.spacing(4),
        position: 'relative',
        transition: 'all 0.3s ease',
        border: '2px solid transparent',

        '& svg': {
          width: '14px',
          height: '14px',
          transition: 'filter 0.3s ease',
        },

        // Subtle gradient border on hover
        '&::before': {
          content: '""',
          position: 'absolute',
          top: -2,
          left: -2,
          right: -2,
          bottom: -2,
          borderRadius: theme.shape.radius.default,
          background: 'linear-gradient(90deg, #FF780A, #FF8C2A, #FFA040)',
          opacity: 0,
          transition: 'opacity 0.3s ease',
          zIndex: -1,
        },

        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: '0 4px 12px rgba(255, 120, 10, 0.1)',

          '&::before': {
            opacity: 0.3,
          },

          '& svg': {
            filter: 'drop-shadow(0 0 6px rgba(255, 120, 10, 0.4))',
          },
        },

        // Active state with stronger gradient
        '&[aria-pressed="true"], &[data-active="true"]': {
          '&::before': {
            opacity: 0.5,
          },

          '& svg': {
            filter: 'drop-shadow(0 0 8px rgba(255, 120, 10, 0.6))',
          },
        },
    }),

    activeButton: css({
        '&::before': {
          opacity: 0.5,
        },
        
        boxShadow: '0 0 20px rgba(255, 120, 10, 0.3)',
        
        '& svg': {
          filter: 'drop-shadow(0 0 8px rgba(255, 120, 10, 0.6))',
        },
    }),

    tagCount: css({
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: '20px',
        height: '20px',
        padding: theme.spacing(0.25, 0.75),
        fontSize: theme.typography.bodySmall.fontSize,
        fontWeight: theme.typography.fontWeightBold,
        color: '#fff',
        backgroundColor: '#FF780A',
        borderRadius: theme.shape.radius.pill,
        marginLeft: theme.spacing(1),
        boxShadow: '0 0 12px rgba(255, 120, 10, 0.6), inset 0 1px 2px rgba(255, 255, 255, 0.2)',
        animation: 'pulse 2s ease-in-out infinite',
        
        '@keyframes pulse': {
          '0%, 100%': {
            boxShadow: '0 0 12px rgba(255, 120, 10, 0.6), inset 0 1px 2px rgba(255, 255, 255, 0.2)',
          },
          '50%': {
            boxShadow: '0 0 20px rgba(255, 120, 10, 0.8), inset 0 1px 2px rgba(255, 255, 255, 0.3)',
          },
        },
    }),

    dropdownContent: css({
        padding: theme.spacing(2),
        maxWidth: '320px',
        minWidth: '320px',
        backgroundColor: theme.colors.background.primary,
        border: '2px solid transparent',
        borderRadius: theme.shape.radius.default,
        boxShadow: '0 8px 32px rgba(255, 120, 10, 0.15), 0 0 0 1px rgba(255, 120, 10, 0.1)',
        position: 'relative',
        overflow: 'hidden',
        
        // Gradient border effect
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          borderRadius: theme.shape.radius.default,
          padding: '2px',
          background: 'linear-gradient(135deg, #FF780A, #FF8C2A, #FFA040)',
          WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
          WebkitMaskComposite: 'xor',
          maskComposite: 'exclude',
          opacity: 0.4,
          pointerEvents: 'none',
        },
        
        // Subtle animated gradient background
        '&::after': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '60px',
          background: 'linear-gradient(180deg, rgba(255, 120, 10, 0.05) 0%, transparent 100%)',
          pointerEvents: 'none',
          zIndex: 0,
        },
        
        // Make sure content is above pseudo-elements
        '& > *': {
          position: 'relative',
          zIndex: 1,
        },
    }),

    helpText: css({
        display: 'flex',
        alignItems: 'flex-start',
        gap: theme.spacing(1),
        marginTop: theme.spacing(2),
        padding: theme.spacing(1.5),
        backgroundColor: 'rgba(255, 120, 10, 0.05)',
        borderRadius: theme.shape.radius.default,
        border: '1px solid rgba(255, 120, 10, 0.2)',
        
        '& svg': {
          color: '#FF780A',
          marginTop: '2px',
          flexShrink: 0,
        },
    }),
});

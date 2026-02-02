import { css } from '@emotion/css';
import { useDialog } from '@react-aria/dialog';
import { FocusScope } from '@react-aria/focus';
import { useOverlay } from '@react-aria/overlays';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Icon, Input, Tab, TabsBar, useStyles2 } from '@grafana/ui';
import { t } from 'app/core/internationalization';
import { getFeatureStatus } from 'app/features/dashboard/services/featureFlagSrv';

interface KeyValuePair {
  id: string;
  key: string;
  value: string;
}

interface KeySelectorProps {
  isOpen: boolean;
  onClose: () => void;
  keys: KeyValuePair[];
  globalKeys: KeyValuePair[];
  onSelect: (key: string) => void;
}

function useKeyboardShortcut(key: string, callback: () => void) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.key.toLowerCase() === key.toLowerCase()) {
        event.preventDefault();
        callback();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [key, callback]);
}

// Create a context to manage the KeySelector state globally
interface KeySelectorContextType {
  openKeySelector: (onSelectCallback: (key: string) => void) => void;
}

const KeySelectorContext = createContext<KeySelectorContextType | undefined>(undefined);

// Provider component
export function KeySelectorProvider({
  children,
  keys,
  resourceUid,
}: {
  children: React.ReactNode;
  keys: any;
  resourceUid: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [globalKeys, setGlobalKeys] = useState<KeyValuePair[]>([]);
  const [onSelectCallback, setOnSelectCallback] = useState<((key: string) => void) | null>(null);
  const lastActiveElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    try {
      const gL = localStorage.getItem('globalLocales');
      if (gL) {
        const gLObj = JSON.parse(gL);
        setGlobalKeys(Object.keys(gLObj).map((key) => ({ id: key, key: key, value: gLObj[key] })));
      }
    } catch (e) {}
  }, []);

  const openKeySelector = useCallback((callback: (key: string) => void) => {
    lastActiveElement.current = document.activeElement as HTMLElement;
    setOnSelectCallback(() => callback);
    setIsOpen(true);
  }, []);

  // Handle keyboard shortcut
  useKeyboardShortcut('y', () => {
    if (
      !isOpen &&
      (document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement) &&
      getFeatureStatus('bhd-localization')
    ) {
      const input = document.activeElement;
      openKeySelector((selectedKey: string) => {
        const prototype =
          input instanceof HTMLInputElement ? window.HTMLInputElement.prototype : window.HTMLTextAreaElement.prototype;

        const valueSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
        if (valueSetter) {
          valueSetter.call(input, `${input.value ?? ''}{{${selectedKey}}}`);
        } else {
          input.value += `{{${selectedKey}}}`;
        }

        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
    }
  });

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setOnSelectCallback(null);
    // Restore focus after a short delay to ensure it happens after the modal closes
    setTimeout(() => {
      lastActiveElement.current?.focus();
    }, 0);
  }, []);

  const handleSelect = useCallback(
    (keyId: string) => {
      if (onSelectCallback) {
        onSelectCallback(keyId);
      }
      handleClose();
    },
    [onSelectCallback, handleClose]
  );

  return (
    <KeySelectorContext.Provider value={{ openKeySelector }}>
      {children}
      <KeySelector
        isOpen={isOpen && !!resourceUid}
        onClose={handleClose}
        keys={Object.keys(keys)
          .filter((key) => key !== 'name')
          .map((key) => ({ id: key, key: key, value: keys[key] }))}
        globalKeys={globalKeys}
        onSelect={handleSelect}
      />
    </KeySelectorContext.Provider>
  );
}

// Hook to use the KeySelector
export function useKeySelector() {
  const context = useContext(KeySelectorContext);
  if (!context) {
    throw new Error('useKeySelector must be used within a KeySelectorProvider');
  }
  return context;
}

// Original KeySelector component (mostly unchanged)
function KeySelector({ isOpen, onClose, keys, globalKeys, onSelect }: KeySelectorProps) {
  const styles = useStyles2(getStyles);
  const ref = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState(2); // 1 for global, 2 for local

  const { overlayProps } = useOverlay({ isOpen, onClose }, ref);

  const { dialogProps } = useDialog({}, ref);

  if (!isOpen) {
    return null;
  }

  const handleOutsideClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const filterKeys = (items: KeyValuePair[]) => {
    if (!searchQuery) {
      return items;
    }
    return items.filter(
      (item) =>
        item.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.value.toLowerCase().includes(searchQuery.toLowerCase())
    );
  };

  const filteredKeys = filterKeys(keys);
  const filteredGlobalKeys = filterKeys(globalKeys);

  const renderKeyList = (keyItems: KeyValuePair[]) => (
    <div className={styles.keyList}>
      {keyItems.map((keyItem) => (
        <div key={keyItem.id} className={styles.keyItem} onClick={() => onSelect(keyItem.key)}>
          <div className={styles.keyItemContent}>
            <div className={styles.keyName}>{keyItem.key}</div>
            <div className={styles.keyValue}>{keyItem.value}</div>
          </div>
        </div>
      ))}
      {keyItems.length === 0 && <div className={styles.noResults}>No matching keys found</div>}
    </div>
  );

  return (
    <div className={styles.positioner} onClick={handleOutsideClick}>
      <div className={styles.animator}>
        <FocusScope contain autoFocus restoreFocus>
          <div {...overlayProps} {...dialogProps} ref={ref} className={styles.container}>
            <div className={styles.searchContainer}>
              <Icon name="search" size="md" />
              <Input
                placeholder={t('bmc.manage-locales.search-keys', 'Search keys...')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.currentTarget.value)}
                className={styles.searchInput}
              />
            </div>
            <TabsBar className={styles.tabsBar}>
              <Tab
                label={t('bmc.manage-locales.local-keys-text', 'Local keys')}
                active={activeTab === 2}
                onChangeTab={() => setActiveTab(2)}
                counter={filteredKeys.length}
              />
              <Tab
                label={t('bmc.manage-locales.global-keys-text', 'Global keys')}
                active={activeTab === 1}
                onChangeTab={() => setActiveTab(1)}
                counter={filteredGlobalKeys.length}
              />
            </TabsBar>
            <div className={styles.resultsContainer}>
              {activeTab === 1 ? renderKeyList(filteredGlobalKeys) : renderKeyList(filteredKeys)}
            </div>
          </div>
        </FocusScope>
      </div>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    positioner: css({
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'center',
      padding: theme.spacing(2),
      zIndex: theme.zIndex.portal,
      '&::before': {
        content: '""',
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        background: theme.components.overlay.background,
        backdropFilter: 'blur(1px)',
      },
    }),
    animator: css({
      position: 'relative',
      maxWidth: theme.breakpoints.values.md,
      width: '100%',
      maxHeight: '95vh',
      minHeight: '10vh',
      display: 'flex',
      flexDirection: 'column',
      background: theme.colors.background.primary,
      color: theme.colors.text.primary,
      borderRadius: theme.shape.radius.default,
      border: `1px solid ${theme.colors.border.weak}`,
      boxShadow: theme.shadows.z3,
      backdropFilter: 'none',
      backgroundColor: theme.colors.background.primary,
    }),
    container: css({
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflow: 'hidden',
    }),
    searchContainer: css({
      padding: theme.spacing(1, 2),
      borderBottom: `1px solid ${theme.colors.border.weak}`,
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
      flexShrink: 0,
      background: theme.components.input.background,
    }),
    title: css({
      fontSize: theme.typography.fontSize,
      fontWeight: theme.typography.fontWeightMedium,
    }),
    resultsContainer: css({
      flex: 1,
      overflow: 'auto',
      padding: theme.spacing(1),
    }),
    keyItem: css({
      padding: theme.spacing(1, 2),
      cursor: 'pointer',
      borderRadius: theme.shape.radius.default,
      '&:hover': {
        background: theme.colors.background.secondary,
      },
    }),
    keyItemContent: css({
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing(2),
      justifyContent: 'space-between',
    }),
    keyName: css({
      fontFamily: theme.typography.fontFamilyMonospace,
      fontWeight: theme.typography.fontWeightMedium,
      color: theme.colors.text.primary,
      flexShrink: 0,
      minWidth: '200px',
    }),
    keyValue: css({
      fontSize: theme.typography.bodySmall.fontSize,
      fontFamily: theme.typography.fontFamilyMonospace,
      color: theme.colors.text.secondary,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      flexGrow: 1,
      textAlign: 'right',
    }),
    searchInput: css({
      flex: 1,
    }),
    keyList: css({
      padding: theme.spacing(1),
    }),
    noResults: css({
      padding: theme.spacing(2),
      textAlign: 'center',
      color: theme.colors.text.secondary,
      fontStyle: 'italic',
    }),
    tabsBar: css({
      overflowX: 'initial',
    }),
  };
};

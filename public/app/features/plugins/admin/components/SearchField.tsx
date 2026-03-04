import { useRef, useState } from 'react';
import * as React from 'react';
import { useDebounce } from 'react-use';

import { Trans, t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Button, ButtonGroup, Dropdown, Icon, Input, Menu } from '@grafana/ui';

interface Props {
  value?: string;
  onSearch: (value: string) => void;
  onAssistant?: (query: string) => void;
  onGetStarted?: () => void;
  isAssistantAvailable?: boolean;
}

// useDebounce has a bug which causes it to fire on first render. This wrapper prevents that.
// https://github.com/streamich/react-use/issues/759
const useDebounceWithoutFirstRender = (callBack: () => void, delay = 0, deps: React.DependencyList = []) => {
  const isFirstRender = useRef(true);
  const debounceDeps = [...deps, isFirstRender];

  return useDebounce(
    () => {
      if (isFirstRender.current) {
        isFirstRender.current = false;
        return;
      }
      return callBack();
    },
    delay,
    debounceDeps
  );
};

export const SearchField = ({ value, onSearch, onAssistant, onGetStarted, isAssistantAvailable }: Props) => {
  const [query, setQuery] = useState(value ?? '');
  const inputRef = useRef<HTMLInputElement>(null);

  useDebounceWithoutFirstRender(() => onSearch(query), 500, [query]);

  const showAssistant = isAssistantAvailable && config.featureToggles.pluginSearchAssistant;

  const placeholder = showAssistant
    ? t('plugins.search-field.placeholder', 'Search plugins (Enter) or ask Assistant (Shift+Enter)')
    : t('plugins.search-field.placeholder-search-grafana-plugins', 'Search Grafana plugins');

  const clearButton = query !== '' && (
    <Button
      icon="times"
      fill="text"
      size="sm"
      onClick={(e) => {
        inputRef.current?.focus();
        setQuery('');
        onSearch('');
        e.stopPropagation();
      }}
    >
      <Trans i18nKey="grafana-ui.filter-input.clear">Clear</Trans>
    </Button>
  );

  const assistantMenu = (
    <Menu>
      <Menu.Item
        icon="ai"
        label={t('plugins.search-field.ask-assistant', 'Ask Assistant')}
        onClick={() => onAssistant?.(query)}
      />
      <Menu.Item
        icon="ai"
        label={t('plugins.search-field.get-started', 'Help me get started')}
        onClick={() => onGetStarted?.()}
      />
    </Menu>
  );

  const suffix = showAssistant ? (
    <>
      {clearButton}
      <ButtonGroup>
        <Button
          variant="primary"
          size="sm"
          fill="text"
          onClick={() => onSearch(query)}
          aria-label={t('plugins.search-field.search-button', 'Search')}
        >
          {t('plugins.search-field.search-button', 'Search')}
        </Button>
        <Dropdown overlay={assistantMenu} placement="bottom-end">
          <Button
            variant="primary"
            size="sm"
            fill="text"
            icon="angle-down"
            aria-label={t('plugins.search-field.more-options', 'More search options')}
          />
        </Dropdown>
      </ButtonGroup>
    </>
  ) : (
    clearButton || undefined
  );

  return (
    <Input
      ref={inputRef}
      value={query}
      prefix={<Icon name="search" />}
      suffix={suffix}
      width={showAssistant ? 70 : 46}
      type="text"
      placeholder={placeholder}
      onChange={(e) => setQuery(e.currentTarget.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          if (e.shiftKey && onAssistant) {
            e.preventDefault();
            onAssistant(query);
          } else {
            onSearch(query);
          }
        }
      }}
    />
  );
};

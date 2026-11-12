import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { Button, ButtonGroup, Divider, Dropdown, Menu, Stack } from '@grafana/ui';
import { useSavedQueriesAvailable } from 'app/features/notebook/utils';

import { getNotebookBlockTypeOptions, type NotebookBlockType } from './NotebookBlockTypeMenu';

interface Props {
  onAdd: (type: NotebookBlockType) => void;
  /** "New from Saved Queries": adds a chevron menu to the Visualization button when saved queries are available. */
  onAddSavedQuery?: () => void;
}

/**
 * Always-visible row of add-block buttons at the bottom of the notebook, unlike the per-cell add button:
 * no hover-reveal, and each button adds a fixed type. Visualization gets a chevron menu for its saved-query option.
 */
export function NotebookFooterAddCell({ onAdd, onAddSavedQuery }: Props) {
  const savedQueriesAvailable = useSavedQueriesAvailable();

  return (
    <>
      <Divider />
      <Stack direction="row" gap={1} wrap="wrap" alignItems="center">
        {getNotebookBlockTypeOptions().map((option) => {
          const button = (
            <Button
              key={option.type}
              variant="secondary"
              size="sm"
              icon={option.icon}
              onClick={() => onAdd(option.type)}
              data-testid={selectors.pages.Notebooks.Item.footerAddCellButton(option.type)}
            >
              {option.label}
            </Button>
          );

          if (option.type !== 'visualization' || !savedQueriesAvailable || !onAddSavedQuery) {
            return button;
          }

          return (
            <ButtonGroup key={option.type}>
              {button}
              <Dropdown
                placement="bottom-end"
                overlay={
                  <Menu>
                    <Menu.Item
                      icon="book-open"
                      label={t('notebook.add-block.new-from-saved-queries', 'New from Saved Queries')}
                      onClick={onAddSavedQuery}
                    />
                  </Menu>
                }
              >
                <Button
                  variant="secondary"
                  size="sm"
                  icon="angle-down"
                  aria-label={t('notebook.add-block.more-visualization-options', 'More visualization options')}
                />
              </Dropdown>
            </ButtonGroup>
          );
        })}
      </Stack>
    </>
  );
}

import { uniqBy } from 'lodash';
import { useState } from 'react';

import { t, Trans } from '@grafana/i18n';
import { getBackendSrv, locationService, usePluginComponent } from '@grafana/runtime';
import { Button, Combobox, type ComboboxOption, Field, Modal } from '@grafana/ui';
import { ASSISTANT_PLUGIN_ID } from 'app/core/constants';

import { getHomePageRef, PAGE_VIEW_COMPONENT_ID } from './homePageRef';
import { useHomePageChoice } from './useHomePageChoice';

const PAGE_CATALOG_URL = `/api/plugins/${ASSISTANT_PLUGIN_ID}/resources/api/v1/page-catalog`;

interface CatalogEntry {
  id: string;
  title: string;
  description?: string;
}

// Home is only ever shown to the user who picked it, so their own drafts and unlisted pages
// belong in the list next to the pages shared in folders.
const SECTIONS = ['mine', 'unlisted', 'discover'];

const toOption = (page: CatalogEntry): ComboboxOption<string> => ({
  value: page.id,
  label: page.title,
  description: page.description,
});

/** The page a pasted page URL names, so a page can be picked straight from its address. */
async function findPastedPage(text: string): Promise<CatalogEntry | undefined> {
  const ref = getHomePageRef(text);
  if (!ref) {
    return undefined;
  }
  const response = await getBackendSrv().get<{ data: { page: CatalogEntry } }>(`${PAGE_CATALOG_URL}/${ref}`);
  return response.data.page;
}

/** Pages the user can open, best match first; without search text, the most recent. */
async function searchPages(search: string): Promise<Array<ComboboxOption<string>>> {
  const text = search.trim();
  const [pasted, ...sections] = await Promise.allSettled([
    findPastedPage(text),
    ...SECTIONS.map((section) =>
      getBackendSrv().get<{ data: { pages: CatalogEntry[] } }>(PAGE_CATALOG_URL, {
        section,
        search: text || undefined,
        sort: text ? 'relevance' : 'recent',
        limit: 20,
      })
    ),
  ]);
  const pages = sections.flatMap((result) => (result.status === 'fulfilled' ? result.value.data.pages : []));
  if (pasted.status === 'fulfilled' && pasted.value) {
    pages.unshift(pasted.value);
  }
  if (pages.length === 0 && sections.every((result) => result.status === 'rejected')) {
    throw new Error('Grafana Pages could not be listed');
  }
  return uniqBy(pages, (page) => page.id).map(toOption);
}

/** Whether a Grafana Page could render as home: without the Assistant's page view, a picked page never would. */
export function useCanPickHomePage() {
  const { component, isLoading } = usePluginComponent(PAGE_VIEW_COMPONENT_ID);
  return !isLoading && !!component;
}

/** Lets a user make a Grafana Page their home, or go back to the default homepage. */
export function HomePagePickerModal({ onDismiss }: { onDismiss: () => void }) {
  const { pageId: currentPageId, setPageId } = useHomePageChoice();
  const [selected, setSelected] = useState<ComboboxOption<string> | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const save = async (pageId: string | null) => {
    setIsSaving(true);
    try {
      await setPageId(pageId);
      onDismiss();
      // The picker opens from anywhere, so show the new home where it lives
      if (pageId) {
        locationService.push('/');
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal title={t('home.page-picker.title', 'Choose your home page')} isOpen onDismiss={onDismiss}>
      <Field
        noMargin
        label={t('home.page-picker.label', 'Grafana Page')}
        description={t(
          'home.page-picker.description',
          'Only you see this change. Search your pages and pages shared with you, or paste a page link.'
        )}
      >
        <Combobox
          id="home-page-picker"
          value={selected}
          options={searchPages}
          onChange={setSelected}
          placeholder={t('home.page-picker.placeholder', 'Search pages or paste a link')}
          noOptionsMessage={t('home.page-picker.no-options', 'No pages found')}
        />
      </Field>
      <Modal.ButtonRow>
        {currentPageId && (
          <Button variant="secondary" fill="outline" onClick={() => save(null)} disabled={isSaving}>
            <Trans i18nKey="home.page-picker.reset">Use the default homepage</Trans>
          </Button>
        )}
        <Button variant="secondary" onClick={onDismiss}>
          <Trans i18nKey="home.page-picker.cancel">Cancel</Trans>
        </Button>
        <Button onClick={() => selected && save(selected.value)} disabled={!selected || isSaving}>
          <Trans i18nKey="home.page-picker.save">Set as home</Trans>
        </Button>
      </Modal.ButtonRow>
    </Modal>
  );
}

/** Invites picking a Grafana Page from the default homepage. */
export function HomePagePicker() {
  const canPick = useCanPickHomePage();
  const [isOpen, setIsOpen] = useState(false);

  if (!canPick) {
    return null;
  }

  return (
    <>
      <Button variant="secondary" icon="home-alt" onClick={() => setIsOpen(true)}>
        {t('home.page-picker.open', 'Use a page as home')}
      </Button>
      {isOpen && <HomePagePickerModal onDismiss={() => setIsOpen(false)} />}
    </>
  );
}

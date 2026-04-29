import { useId, useMemo } from 'react';

import { t } from '@grafana/i18n';
import { SceneObjectBase, type SceneObjectRef, type SceneObjectState } from '@grafana/scenes';
import type { DashboardLink } from '@grafana/schema';
import { appEvents } from 'app/core/app_events';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';
import { ShowConfirmModalEvent } from 'app/types/events';

import { type DashboardScene } from '../../scene/DashboardScene';
import {
  type EditableDashboardElement,
  type EditableDashboardElementInfo,
} from '../../scene/types/EditableDashboardElement';

import {
  LinkBooleanSwitch,
  LinkIconSelect,
  LinkPlacementSwitch,
  LinkTagsInput,
  LinkTextInput,
  LinkTypeSelect,
} from './LinkBasicOptions';
import { linkEditActions } from './actions';
import { NEW_LINK } from './utils';

// Default to dropdown for new links because if a dashboard has a lot of links,
// the side pane will be pushed down the page and be unscrollable
export function createDefaultLink(): DashboardLink {
  return { ...NEW_LINK, asDropdown: true };
}

function createLinkEdit(dashboard: DashboardScene, linkIndex: number): LinkEdit {
  const selectionId = linkSelectionId(linkIndex);
  return new LinkEdit({ dashboardRef: dashboard.getRef(), linkIndex, key: selectionId });
}

export function openAddLinkPane(dashboard: DashboardScene) {
  const newLink = createDefaultLink();
  const linkIndex = (dashboard.state.links ?? []).length;
  const element = createLinkEdit(dashboard, linkIndex);

  linkEditActions.addLink({ dashboard, link: newLink, addedObject: element });
}

export function linkSelectionId(linkIndex: number) {
  return `dashboard-link-${linkIndex}`;
}

export function openLinkEditPane(dashboard: DashboardScene, linkIndex: number) {
  const element = createLinkEdit(dashboard, linkIndex);
  dashboard.state.editPane.selectObject(element, { force: true, multi: false });
}

export interface LinkEditState extends SceneObjectState {
  dashboardRef: SceneObjectRef<DashboardScene>;
  linkIndex: number;
}

export class LinkEdit extends SceneObjectBase<LinkEditState> {}

function useLinkTypeShowIf(linkEdit: LinkEdit, type: 'dashboards' | 'link') {
  const dashboard = linkEdit.state.dashboardRef.resolve();
  const { links } = dashboard.useState();
  const link = (links ?? [])[linkEdit.state.linkIndex];
  return link?.type === type;
}

function useEditPaneOptions(
  this: LinkEditEditableElement,
  linkEdit: LinkEdit,
  isNewElement: boolean
): OptionsPaneCategoryDescriptor[] {
  const basicCategoryId = useId();
  const titleId = useId();
  const typeId = useId();
  const tagsId = useId();
  const urlId = useId();
  const tooltipId = useId();
  const iconId = useId();

  const optionsCategoryId = useId();
  const asDropdownId = useId();
  const keepTimeId = useId();
  const includeVarsId = useId();
  const targetBlankId = useId();
  const placementId = useId();

  const basicCategory = useMemo(() => {
    return new OptionsPaneCategoryDescriptor({ title: '', id: basicCategoryId })
      .addItem(
        new OptionsPaneItemDescriptor({
          title: '',
          id: titleId,
          render: () => <LinkTextInput linkEdit={linkEdit} prop="title" autoFocus={isNewElement} />,
        })
      )
      .addItem(
        new OptionsPaneItemDescriptor({
          title: '',
          id: typeId,
          render: () => <LinkTypeSelect linkEdit={linkEdit} />,
        })
      )
      .addItem(
        new OptionsPaneItemDescriptor({
          title: '',
          id: tagsId,
          useShowIf: () => useLinkTypeShowIf(linkEdit, 'dashboards'),
          render: () => <LinkTagsInput linkEdit={linkEdit} />,
        })
      )
      .addItem(
        new OptionsPaneItemDescriptor({
          title: '',
          id: urlId,
          useShowIf: () => useLinkTypeShowIf(linkEdit, 'link'),
          render: () => <LinkTextInput linkEdit={linkEdit} prop="url" />,
        })
      )
      .addItem(
        new OptionsPaneItemDescriptor({
          title: '',
          id: tooltipId,
          useShowIf: () => useLinkTypeShowIf(linkEdit, 'link'),
          render: () => <LinkTextInput linkEdit={linkEdit} prop="tooltip" />,
        })
      )
      .addItem(
        new OptionsPaneItemDescriptor({
          title: '',
          id: iconId,
          useShowIf: () => useLinkTypeShowIf(linkEdit, 'link'),
          render: () => <LinkIconSelect linkEdit={linkEdit} />,
        })
      );
  }, [basicCategoryId, titleId, typeId, tagsId, urlId, tooltipId, iconId, linkEdit, isNewElement]);

  const optionsCategory = useMemo(() => {
    return new OptionsPaneCategoryDescriptor({
      title: t('dashboard-scene.link-options.options-category', 'Options'),
      id: optionsCategoryId,
      isOpenDefault: true,
    })
      .addItem(
        new OptionsPaneItemDescriptor({
          title: t('dashboard-scene.link-options.show-as-dropdown', 'Show as dropdown'),
          id: asDropdownId,
          useShowIf: () => {
            const dashboard = linkEdit.state.dashboardRef.resolve();
            const { links } = dashboard.useState();
            const link = (links ?? [])[linkEdit.state.linkIndex];
            return link?.type === 'dashboards';
          },
          render: (d) => <LinkBooleanSwitch linkEdit={linkEdit} id={d.props.id} prop="asDropdown" />,
        })
      )
      .addItem(
        new OptionsPaneItemDescriptor({
          title: t('dashboard-scene.link-options.include-time-range', 'Include current time range'),
          id: keepTimeId,
          render: (d) => <LinkBooleanSwitch linkEdit={linkEdit} id={d.props.id} prop="keepTime" />,
        })
      )
      .addItem(
        new OptionsPaneItemDescriptor({
          title: t('dashboard-scene.link-options.include-variables', 'Include current template variable values'),
          id: includeVarsId,
          render: (d) => <LinkBooleanSwitch linkEdit={linkEdit} id={d.props.id} prop="includeVars" />,
        })
      )
      .addItem(
        new OptionsPaneItemDescriptor({
          title: t('dashboard-scene.link-options.open-in-new-tab', 'Open link in new tab'),
          id: targetBlankId,
          render: (d) => <LinkBooleanSwitch linkEdit={linkEdit} id={d.props.id} prop="targetBlank" />,
        })
      )
      .addItem(
        new OptionsPaneItemDescriptor({
          title: t('dashboard-scene.link-options.show-in-controls-menu', 'Show in controls menu'),
          id: placementId,
          render: (d) => <LinkPlacementSwitch linkEdit={linkEdit} id={d.props.id} />,
        })
      );
  }, [optionsCategoryId, asDropdownId, keepTimeId, includeVarsId, targetBlankId, placementId, linkEdit]);

  return [basicCategory, optionsCategory];
}

export class LinkEditEditableElement implements EditableDashboardElement {
  public readonly isEditableDashboardElement = true;
  public readonly typeName = 'Link';

  public constructor(private linkEdit: LinkEdit) {}

  public getEditableElementInfo(): EditableDashboardElementInfo {
    const dashboard = this.linkEdit.state.dashboardRef.resolve();
    const links = dashboard.state.links ?? [];
    const link = links[this.linkEdit.state.linkIndex];
    const instanceName = link?.title ?? t('dashboard-scene.add-link.inline-instance-name', 'New link');
    return {
      typeName: t('dashboard-scene.add-link.label-link', 'Link'),
      icon: 'external-link-alt',
      instanceName,
    };
  }

  public useEditPaneOptions = useEditPaneOptions.bind(this, this.linkEdit);

  public onDuplicate() {
    const dashboard = this.linkEdit.state.dashboardRef.resolve();
    const { links } = dashboard.state;

    const link = { ...links[this.linkEdit.state.linkIndex] };
    link.title = `${link.title} - Copy`;
    const linkEdit = createLinkEdit(dashboard, this.linkEdit.state.linkIndex);

    linkEditActions.addLink({ dashboard, link, addedObject: linkEdit });
    openLinkEditPane(dashboard, links.length);
  }

  public onConfirmDelete(): void {
    const dashboard = this.linkEdit.state.dashboardRef.resolve();
    const links = dashboard.state.links ?? [];
    const link = links[this.linkEdit.state.linkIndex];
    const name = link?.title ?? t('dashboard-scene.link-editable-element.unnamed', 'Unnamed link');
    appEvents.publish(
      new ShowConfirmModalEvent({
        title: t('dashboard-scene.link-editable-element.delete-title', 'Delete link'),
        text: t('dashboard-scene.link-editable-element.delete-text', 'Are you sure you want to delete: {{name}}?', {
          name,
        }),
        yesText: t('dashboard-scene.link-editable-element.delete-confirm', 'Delete link'),
        onConfirm: () => {
          this.onDelete();
        },
      })
    );
  }

  public onDelete(): void {
    const dashboard = this.linkEdit.state.dashboardRef.resolve();
    const editPane = dashboard.state.editPane;
    const linkIndex = this.linkEdit.state.linkIndex;
    const currentLinks = dashboard.state.links ?? [];

    if (linkIndex < 0 || linkIndex >= currentLinks.length) {
      editPane.selectObject(dashboard);
      return;
    }

    linkEditActions.removeLink({ dashboard, linkIndex });
    editPane.selectObject(dashboard);
  }
}

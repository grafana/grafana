import { isEqual } from 'lodash';

import { type SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';
import { type AdHocFiltersController, type AdHocFilterWithLabels } from '@grafana/scenes';

export class AdHocOriginFiltersController implements AdHocFiltersController {
  constructor(
    private filters: AdHocFilterWithLabels[],
    private setFilters: (filters: AdHocFilterWithLabels[]) => void,
    private wip: AdHocFilterWithLabels | undefined,
    private setWip: (wip: AdHocFilterWithLabels | undefined) => void,
    private _allowCustomValue = true,
    private _getKeys: (currentKey: string | null) => Promise<Array<SelectableValue<string>>>,
    private _getValuesFor: (filter: AdHocFilterWithLabels) => Promise<Array<SelectableValue<string>>>,
    private _getOperators: () => Array<SelectableValue<string>>
  ) {}

  useState() {
    return {
      filters: this.filters,
      wip: this.wip,
      readOnly: false,
      allowCustomValue: this._allowCustomValue,
      supportsMultiValueOperators: true,
      enableGroupBy: false,
      inputPlaceholder: t(
        'dashboard-scene.adhoc-origin-filters-controller.input-placeholder',
        'Add a default filter...'
      ),
    };
  }

  getKeys(currentKey: string | null): Promise<Array<SelectableValue<string>>> {
    return this._getKeys(currentKey);
  }

  getValuesFor(filter: AdHocFilterWithLabels): Promise<Array<SelectableValue<string>>> {
    return this._getValuesFor(filter);
  }

  getOperators(): Array<SelectableValue<string>> {
    return this._getOperators();
  }

  private findFilterIndex(filter: AdHocFilterWithLabels): number {
    return this.filters.findIndex((f) => isEqual(f, filter));
  }

  updateFilter(filter: AdHocFilterWithLabels, update: Partial<AdHocFilterWithLabels>): void {
    if (filter === this.wip) {
      const merged = { ...this.wip, ...update };
      if ('value' in update && update.value !== '' && merged.key) {
        this.setFilters([...this.filters, { ...merged, origin: 'dashboard' }]);
        this.setWip(undefined);
      } else {
        this.setWip(merged);
      }
      return;
    }

    const index = this.findFilterIndex(filter);
    if (index !== -1) {
      this.setFilters(this.filters.map((f, i) => (i === index ? { ...f, ...update, origin: 'dashboard' } : f)));
    }
  }

  updateToMatchAll(filter: AdHocFilterWithLabels): void {
    this.removeFilter(filter);
  }

  removeFilter(filter: AdHocFilterWithLabels): void {
    const index = this.findFilterIndex(filter);
    if (index !== -1) {
      this.setFilters(this.filters.filter((_, i) => i !== index));
    }
  }

  removeLastFilter(): void {
    if (this.filters.length > 0) {
      this.setFilters(this.filters.slice(0, -1));
    }
  }

  handleComboboxBackspace(filter: AdHocFilterWithLabels): void {
    const index = this.findFilterIndex(filter);

    if (index > 0) {
      this.setFilters(
        this.filters.map((f, i) => (i === index - 1 ? { ...f, forceEdit: true } : { ...f, forceEdit: false }))
      );
    }
  }

  addWip(): void {
    this.setWip({
      key: '',
      operator: '=',
      value: '',
      origin: 'dashboard',
    });
  }

  restoreOriginalFilter(filter: AdHocFilterWithLabels): void {
    // Not applicable
  }

  clearAll(): void {
    this.setFilters([]);
    this.setWip(undefined);
  }
}

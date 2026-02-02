import { PureComponent } from 'react';
import { connect, ConnectedProps } from 'react-redux';
import { Observable, throwError } from 'rxjs';
import { catchError, map, take, tap } from 'rxjs/operators';

import { getBackendSrv, getDataSourceSrv } from '@grafana/runtime';
import { ThunkDispatch } from 'app/types';

import {
  DataSourceInstanceSettings,
  OptimizeVariableModel,
  SelectableValue,
} from '../../../../../packages/grafana-data';
import { VariablePickerProps } from '../pickers/types';

import { DomainFilter } from './domain-filter/DomainFilter';
import { initialOptimizeVariableModelState } from './reducer';
import { getVariables, RequestOptions, setVariables } from './utils';

export interface DatamartDomain {
  name: string;
  id: string;
  breadcrumb: Breadcrumb[];
  haschildren: boolean;
  selected?: boolean;
}
export interface Breadcrumb {
  name: string;
  id: number;
}
export interface DomainFilterState {
  domainsFilter: SearchItemState;
}
export interface SearchItemState {
  show: boolean;
  options: SelectableValue[];
  selected: SelectableValue[];
  breadcrumbs: SelectableValue[];
  rootItem: number;
  loading: boolean;

  pagination: Pagination;
  count: number;
}

export interface Pagination {
  page: number;
  size?: number;
}

enum ExposedAPIs {
  LOAD_DOMAINS,
  LOAD_CHILDREN,
}

export const DEFAULT_PAGINATION = { page: 0, size: 25 };

interface OwnProps extends VariablePickerProps<OptimizeVariableModel> {}

type Props = OwnProps & ConnectedProps<typeof connector>;

const ROOT_RESOURCE_ID = 0;
const mapDispatchToProps = (dispatch: ThunkDispatch) => {
  return {};
};

function isNumeric(num: any) {
  return (typeof num === 'number' || (typeof num === 'string' && num.trim() !== '')) && !isNaN(num as number);
}

const mapStateToProps = (state: DomainFilterState, ownProps: OwnProps) => {
  const { rootStateKey, filterondescendant } = ownProps.variable;

  if (!rootStateKey) {
    return {
      picker: initialOptimizeVariableModelState,
      filterondescendant,
    };
  }

  return {
    filterondescendant,
  };
};

const connector = connect(mapStateToProps, mapDispatchToProps);

export class OptimizeVariablePickerUnconnected extends PureComponent<Props, DomainFilterState> {
  private static readonly API_CATALOGPROXY = '/opt/api/v1/catalogproxy/';
  static readonly API_CATALOGPROXY_DOMAINS_SEARCH = `${OptimizeVariablePickerUnconnected.API_CATALOGPROXY}entities/APP/<parentId>/flatsearch`;
  static readonly API_CATALOGPROXY_DOMAINS_CHILDREN = `${OptimizeVariablePickerUnconnected.API_CATALOGPROXY}entities/APP/<parentId>/children/APP`;

  static readonly API_CATALOGPROXY_ENTITIES = `${OptimizeVariablePickerUnconnected.API_CATALOGPROXY}entities/APP`;

  bmcDatasource: DataSourceInstanceSettings | undefined;

  filterondescendant: any;
  navigationHistory: ExposedAPIs;

  constructor(props: Props) {
    super(props);

    this.bmcDatasource = getDataSourceSrv().getInstanceSettings('BMC Helix');
    this.filterondescendant = props?.variable?.filterondescendant;
    this.navigationHistory = ExposedAPIs.LOAD_CHILDREN;

    if (!this.bmcDatasource) {
      console.error('Unable to get BMC Helix datasource', getDataSourceSrv().getList());
    }

    this.state = {
      domainsFilter: {
        show: false,
        options: [],
        selected: [],
        loading: false,
        breadcrumbs: [],
        rootItem: ROOT_RESOURCE_ID,
        pagination: DEFAULT_PAGINATION,
        count: 0,
      },
    };
    this.onDeleteAll = this.onDeleteAll.bind(this);
  }

  componentDidMount() {
    let appids = getVariables()?.appid;
    this.setState((state) => ({ domainsFilter: { ...state.domainsFilter, loading: true, selected: [] } }));
    if (typeof appids !== 'string') {
      appids = appids?.filter((appid) => isNumeric(appid));
      if (appids && appids.length) {
        this.getSelectedDomains(appids).subscribe(() => this.loadDomainsChildren(0));
        return;
      }
    }
    this.loadDomainsChildren(0);
  }

  getSelectedDomains = (appids: string | string[] | undefined) => {
    return this.getDomainsAPI(appids).pipe(
      map((domains: DatamartDomain[]) =>
        domains.map((domain) => ({
          label: domain.name,
          value: domain.id,
          hasChildren: domain.haschildren,
          description: domain.breadcrumb ? domain.breadcrumb.map((item) => item.name).join('>') : '',
        }))
      ),
      catchError((e) => {
        this.setState((state) => ({ domainsFilter: { ...state.domainsFilter, loading: false, selected: [] } }));
        return throwError(e);
      }),
      tap((selected: SelectableValue[]) => {
        selected.sort(this.sortByLabel);
        this.setState((state) => ({ domainsFilter: { ...state.domainsFilter, loading: false, selected: selected } }));
      }),
      take(1)
    );
  };

  private post(url: string, body: any) {
    const options: RequestOptions = {
      url: this.bmcDatasource?.url + url,
      method: 'POST',
      headers: {
        Authorization: 'Bearer JWT PLACEHOLDER',
        'Content-Type': 'application/json',
      },
      data: body,
    };
    return getBackendSrv().fetch<any>(options as Required<RequestOptions>);
  }

  getDomainsAPI = (appids: string | string[] | undefined) => {
    const url = OptimizeVariablePickerUnconnected.API_CATALOGPROXY_ENTITIES;
    const body = { entityids: appids || [] };
    return this.post(url, body).pipe(map((response) => (response.data ? response.data || [] : [])));
  };

  loadDomains = (searchString: string, parentId: number, pagination?: Pagination) => {
    this.navigationHistory = ExposedAPIs.LOAD_DOMAINS;
    this.setState((state) => ({ domainsFilter: { ...state.domainsFilter, loading: true, options: [] } }));
    this.searchDomains(searchString, parentId, pagination)
      .pipe(
        map((domains: DatamartDomain[]) => {
          const selectedIdToItem = this.selectedToMap();
          return domains.map((domain) => ({
            label: domain.name,
            selected: selectedIdToItem.has(domain.id),
            value: domain.id,
            hasChildren: domain.haschildren,
            description: domain.breadcrumb ? domain.breadcrumb.map((item) => item.name).join('>') : '',
          }));
        }),
        catchError((e) => {
          this.setState((state) => ({ domainsFilter: { ...state.domainsFilter, loading: false, options: [] } }));
          return throwError(e);
        }),
        tap((options: SelectableValue[]) => {
          let currBreadCrumb = this.state.domainsFilter.breadcrumbs;
          if (!currBreadCrumb || !currBreadCrumb.length) {
            currBreadCrumb = [{ label: 'Home', value: 0, hasChildren: true }];
          }
          this.setState((state) => ({
            domainsFilter: { ...state.domainsFilter, loading: false, options: options, breadcrumbs: currBreadCrumb },
          }));
        }),
        take(1)
      )
      .subscribe();
  };

  searchDomains(query: string, parentId: number, pagination?: Pagination): Observable<DatamartDomain[]> {
    const url = OptimizeVariablePickerUnconnected.API_CATALOGPROXY_DOMAINS_SEARCH.replace('<parentId>', `${parentId}`);
    query = query ? query.trim() : query;
    const body = {
      filter: { 'search.string': query },
      pagination: {
        page: pagination?.page || DEFAULT_PAGINATION.page,
        size: pagination?.size || DEFAULT_PAGINATION.size,
      },
      filterondescendant: this.filterondescendant,
    };

    return this.post(url, body).pipe(
      tap((response) =>
        this.setState((state) => ({ domainsFilter: { ...state.domainsFilter, count: response?.data?.count || 0 } }))
      ),
      map((response) => (response.data['children'] ? response.data['children']['APP'] || [] : []))
    );
  }

  onDomainFilterSelected = (selected: SelectableValue[]) => {
    const idToItem: Map<string, SelectableValue> = new Map<string, SelectableValue>();
    (selected || []).forEach((item) => idToItem.set(item.value, item));
    let options: SelectableValue[] = [];
    if (this.state.domainsFilter.options) {
      options = this.state.domainsFilter.options.map((option) => {
        option.selected = idToItem.has(option.value);
        return option;
      });
    }
    this.setState((state) => ({ domainsFilter: { ...state.domainsFilter, options, selected } }));
    this.apply(selected);
  };

  onDomainDrillDown = (domain: SelectableValue) => {
    const breadcrumbs: SelectableValue[] =
      this.state.domainsFilter.breadcrumbs?.length === 0
        ? [{ label: 'Home', value: 0, hasChildren: true }]
        : [...this.state.domainsFilter.breadcrumbs];
    breadcrumbs.push(domain);
    this.setState((state) => ({
      domainsFilter: { ...state.domainsFilter, rootItem: domain.value, breadcrumbs: breadcrumbs },
    }));
    this.loadDomainsChildren(domain.value);
  };

  loadDomainsChildren = (parentId: number, pagination?: Pagination) => {
    this.navigationHistory = ExposedAPIs.LOAD_CHILDREN;
    this.setState((state) => ({ domainsFilter: { ...state.domainsFilter, loading: true, options: [] } }));
    this.getDomainChildren(parentId, pagination)
      .pipe(
        map((domains: DatamartDomain[]) => {
          const selectedIdToItem = this.selectedToMap();
          return domains.map((domain) => ({
            label: domain.name,
            selected: selectedIdToItem.has(domain.id),
            value: domain.id,
            hasChildren: domain.haschildren,
            description: domain.breadcrumb ? domain.breadcrumb.map((item) => item.name).join('>') : '',
          }));
        }),
        catchError((e) => {
          this.setState((state) => ({ domainsFilter: { ...state.domainsFilter, loading: false, options: [] } }));
          return throwError(e);
        }),
        tap((options: SelectableValue[]) => {
          this.setState((state) => ({ domainsFilter: { ...state.domainsFilter, loading: false, options: options } }));
        }),
        take(1)
      )
      .subscribe();
  };

  selectedToMap = (): Map<string, SelectableValue> => {
    const idToItem = new Map<string, SelectableValue>();
    if (!this.state.domainsFilter.selected?.length) {
      return idToItem;
    }
    this.state.domainsFilter.selected.forEach((item) => idToItem.set(item.value, item));
    return idToItem;
  };

  getDomainChildren(parentId: number, pagination?: Pagination): Observable<DatamartDomain[]> {
    const url = OptimizeVariablePickerUnconnected.API_CATALOGPROXY_DOMAINS_CHILDREN.replace(
      '<parentId>',
      `${parentId}`
    );
    const body = {
      pagination: {
        page: pagination?.page || DEFAULT_PAGINATION.page,
        size: pagination?.size || DEFAULT_PAGINATION.size,
      },
      filterondescendant: this.filterondescendant,
    };
    return this.post(url, body).pipe(
      tap((response) =>
        this.setState((state) => ({ domainsFilter: { ...state.domainsFilter, count: response?.data?.count || 0 } }))
      ),
      map((response) => (response.data['children'] ? response.data['children']['APP'] || [] : []))
    );
  }

  onDomainBreadCrumbsItemClick = (domain: SelectableValue) => {
    const index = (this.state.domainsFilter.breadcrumbs || []).findIndex((item) => item.value === domain.value);
    if (index === -1) {
      return;
    }
    const breadcrumbs =
      domain.value === ROOT_RESOURCE_ID ? [] : this.state.domainsFilter.breadcrumbs.slice(0, index + 1);
    this.setState((state) => ({
      domainsFilter: { ...state.domainsFilter, rootItem: domain.value, breadcrumbs: breadcrumbs },
    }));

    if (domain.value === ROOT_RESOURCE_ID) {
      this.loadDomainsChildren(domain.value);
      return;
    }
    this.loadDomainsChildren(domain.value);
  };

  onDeleteAll() {
    let options: SelectableValue[] = [];
    if (this.state.domainsFilter.options) {
      options = this.state.domainsFilter.options.map((option) => {
        option.selected = false;
        return option;
      });
    }
    this.apply([]);
    this.setState((state) => ({ domainsFilter: { ...state.domainsFilter, options, selected: [] } }));
  }

  apply(selected: SelectableValue[]): void {
    let domains = (selected || []).map((domain) => domain.value);
    if (!domains.length) {
      setVariables({ 'var-appid': ['$__all'] });
      return;
    }
    setVariables({ 'var-appid': domains });
  }

  onNavigate(searchString: string, toPage: number): void {
    const { domainsFilter } = this.state;
    if (this.navigationHistory === ExposedAPIs.LOAD_DOMAINS) {
      this.loadDomains(searchString, domainsFilter.rootItem, { page: toPage - 1 });
    } else if (this.navigationHistory === ExposedAPIs.LOAD_CHILDREN) {
      this.loadDomainsChildren(domainsFilter.rootItem || ROOT_RESOURCE_ID, { page: toPage - 1 });
    }
  }

  sortByLabel = (item1: SelectableValue, item2: SelectableValue): number => {
    const labelA = item1.label ? item1.label.toUpperCase() : '';
    const labelB = item2.label ? item2.label.toUpperCase() : '';
    if (labelA < labelB) {
      return -1;
    }
    if (labelA > labelB) {
      return 1;
    }
    return 0;
  };

  onToggleSearchPanel = (open: boolean): void => {
    if (!this.state?.domainsFilter?.selected) {
      return;
    }
    const selected: SelectableValue[] = [...this.state.domainsFilter.selected].sort(this.sortByLabel);
    this.setState((state) => ({
      domainsFilter: { ...state.domainsFilter, selected, breadcrumbs: [], rootItem: ROOT_RESOURCE_ID },
    }));
    if (open) {
      this.loadDomainsChildren(ROOT_RESOURCE_ID);
    }
  };

  onSearch = (query: string, rootId: number): void => {
    if (query && query.trim()) {
      this.loadDomains(query, rootId);
      return;
    }
    this.loadDomainsChildren(rootId);
  };

  render() {
    const { domainsFilter } = this.state;

    return (
      <>
        <DomainFilter
          loading={domainsFilter.loading}
          selected={domainsFilter.selected}
          resultItems={domainsFilter.options}
          onSearch={(searchString: string) => this.onSearch(searchString, domainsFilter.rootItem)}
          breadcrumbsItems={domainsFilter.breadcrumbs}
          onDomainSelected={this.onDomainFilterSelected}
          onDomainDrillDown={this.onDomainDrillDown}
          onBreadCrumbsItemClick={this.onDomainBreadCrumbsItemClick}
          onCancel={this.onDeleteAll}
          onNavigate={(searchString: string, toPage: number) => this.onNavigate(searchString, toPage)}
          count={domainsFilter.count}
          onToggle={this.onToggleSearchPanel}
        />
      </>
    );
  }
}

export const OptimizeVariablePicker = connector(OptimizeVariablePickerUnconnected);

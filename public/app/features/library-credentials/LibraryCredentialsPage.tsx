import { DeleteButton, FilterInput, LinkButton } from '@grafana/ui';
import EmptyListCTA from 'app/core/components/EmptyListCTA/EmptyListCTA';
import Page from 'app/core/components/Page/Page';
import { getNavModel } from 'app/core/selectors/navModel';
import { LibraryCredential } from '@grafana/data';
import { StoreState } from 'app/types';
import React, { PureComponent } from 'react';
import { connect, ConnectedProps } from 'react-redux';
import { deleteLibraryCredentials, loadLibraryCredentials } from './state/actions';
import { getLibraryCredentials } from './state/selectors';
import { setSearchQuery } from './state/reducers';

interface OwnProps {}

function mapStateToProps(state: StoreState, props: OwnProps) {
  return {
    navModel: getNavModel(state.navIndex, 'librarycredentials'),
    libraryCredentials: getLibraryCredentials(state.libraryCredentials),
    searchQuery: state.libraryCredentials.searchQuery,
    hasFetched: state.libraryCredentials.hasFetched,
  };
}

const mapDispatchToProps = {
  loadLibraryCredentials,
  deleteLibraryCredentials,
  setSearchQuery,
};

const connector = connect(mapStateToProps, mapDispatchToProps);

export type Props = OwnProps & ConnectedProps<typeof connector>;

interface State {}

export class LibraryCredentialsPageUnconnected extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);
  }

  componentDidMount() {
    this.props.loadLibraryCredentials();
  }

  onDelete(credential: LibraryCredential) {
    this.props.deleteLibraryCredentials(credential.id);
  }

  render() {
    const { navModel, hasFetched, libraryCredentials, searchQuery, setSearchQuery } = this.props;

    if (!hasFetched) {
      return (
        <Page navModel={navModel}>
          <Page.Contents isLoading={true}>{}</Page.Contents>
        </Page>
      );
    }

    return (
      <Page navModel={navModel}>
        <Page.Contents isLoading={false}>
          {libraryCredentials.length > 0 ? (
            <>
              <div style={{ display: 'flex', gap: '10px' }}>
                <FilterInput
                  value={searchQuery}
                  onChange={setSearchQuery}
                  placeholder="Search user by login, email or name"
                />
                <LinkButton aria-label="Create new library credential" size="md" href={`/org/librarycredentials/new`}>
                  Create new library credential
                </LinkButton>
              </div>
              <table className="filter-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Role</th>
                    <th style={{ width: '34px' }}></th>
                    <th style={{ width: '34px' }} />
                  </tr>
                </thead>
                <tbody>
                  {libraryCredentials.map((credential) => {
                    return (
                      <tr key={credential.id}>
                        <td>{credential.name}</td>
                        <td>{credential.type}</td>
                        <td>
                          <LinkButton
                            aria-label={`Edit Library Credential: ${credential.name}`}
                            icon="pen"
                            size="md"
                            href={`/org/librarycredentials/edit/${credential.id}`}
                          />
                        </td>
                        <td>
                          <DeleteButton
                            aria-label="Delete Library Credential"
                            size="md"
                            onConfirm={() => this.onDelete(credential)}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </>
          ) : (
            <EmptyListCTA
              title="You haven't created any library credentials yet yet."
              buttonIcon="book-open"
              buttonLink="org/librarycredentials/new"
              buttonTitle=" New library credential"
              proTip="Create credentials once, use in multiple datasources, and easily rotate credentials on a regular basis without disrupting dashboards"
              proTipLink=""
              proTipLinkTitle=""
              proTipTarget="_blank"
            />
          )}
        </Page.Contents>
      </Page>
    );
  }
}

const LibraryCredentialsPage = connector(LibraryCredentialsPageUnconnected);
export default LibraryCredentialsPage;

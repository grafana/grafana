import { css } from '@emotion/css';
import React, { useEffect, useMemo, useState } from 'react';
import { connect } from 'react-redux';
import { LinkButton, FilterInput, InlineField, DeleteButton, InteractiveTable, Icon, Tooltip, HorizontalGroup, Pagination, VerticalGroup, useStyles2, Avatar, } from '@grafana/ui';
import EmptyListCTA from 'app/core/components/EmptyListCTA/EmptyListCTA';
import { Page } from 'app/core/components/Page/Page';
import { fetchRoleOptions } from 'app/core/components/RolePicker/api';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types';
import { TeamRolePicker } from '../../core/components/RolePicker/TeamRolePicker';
import { deleteTeam, loadTeams, changePage, changeQuery, changeSort } from './state/actions';
export const TeamList = ({ teams, query, noTeams, hasFetched, loadTeams, deleteTeam, changeQuery, totalPages, page, changePage, changeSort, }) => {
    const [roleOptions, setRoleOptions] = useState([]);
    const styles = useStyles2(getStyles);
    useEffect(() => {
        loadTeams(true);
    }, [loadTeams]);
    useEffect(() => {
        if (contextSrv.licensedAccessControlEnabled() && contextSrv.hasPermission(AccessControlAction.ActionRolesList)) {
            fetchRoleOptions().then((roles) => setRoleOptions(roles));
        }
    }, []);
    const canCreate = contextSrv.hasPermission(AccessControlAction.ActionTeamsCreate);
    const displayRolePicker = shouldDisplayRolePicker();
    const columns = useMemo(() => [
        {
            id: 'avatarUrl',
            header: '',
            cell: ({ cell: { value } }) => value && React.createElement(Avatar, { src: value, alt: "User avatar" }),
        },
        {
            id: 'name',
            header: 'Name',
            cell: ({ cell: { value } }) => value,
            sortType: 'string',
        },
        {
            id: 'email',
            header: 'Email',
            cell: ({ cell: { value } }) => value,
            sortType: 'string',
        },
        {
            id: 'memberCount',
            header: 'Members',
            cell: ({ cell: { value } }) => value,
            sortType: 'number',
        },
        ...(displayRolePicker
            ? [
                {
                    id: 'role',
                    header: 'Role',
                    cell: ({ cell: { value }, row: { original } }) => {
                        const canSeeTeamRoles = contextSrv.hasPermissionInMetadata(AccessControlAction.ActionTeamsRolesList, original);
                        return canSeeTeamRoles && React.createElement(TeamRolePicker, { teamId: original.id, roleOptions: roleOptions });
                    },
                },
            ]
            : []),
        {
            id: 'edit',
            header: '',
            cell: ({ row: { original } }) => {
                const canReadTeam = contextSrv.hasPermissionInMetadata(AccessControlAction.ActionTeamsRead, original);
                return canReadTeam ? (React.createElement("a", { href: `org/teams/edit/${original.id}`, "aria-label": `Edit team ${original.name}` },
                    React.createElement(Tooltip, { content: 'Edit team' },
                        React.createElement(Icon, { name: 'pen' })))) : null;
            },
        },
        {
            id: 'delete',
            header: '',
            cell: ({ row: { original } }) => {
                const canDelete = contextSrv.hasPermissionInMetadata(AccessControlAction.ActionTeamsDelete, original);
                return (React.createElement(DeleteButton, { "aria-label": `Delete team ${original.name}`, size: "sm", disabled: !canDelete, onConfirm: () => deleteTeam(original.id) }));
            },
        },
    ], [displayRolePicker, roleOptions, deleteTeam]);
    return (React.createElement(Page, { navId: "teams" },
        React.createElement(Page.Contents, { isLoading: !hasFetched }, noTeams ? (React.createElement(EmptyListCTA, { title: "You haven't created any teams yet.", buttonIcon: "users-alt", buttonLink: "org/teams/new", buttonTitle: " New team", buttonDisabled: !contextSrv.hasPermission(AccessControlAction.ActionTeamsCreate), proTip: "Assign folder and dashboard permissions to teams instead of users to ease administration.", proTipLink: "", proTipLinkTitle: "", proTipTarget: "_blank" })) : (React.createElement(React.Fragment, null,
            React.createElement("div", { className: "page-action-bar" },
                React.createElement(InlineField, { grow: true },
                    React.createElement(FilterInput, { placeholder: "Search teams", value: query, onChange: changeQuery })),
                React.createElement(LinkButton, { href: canCreate ? 'org/teams/new' : '#', disabled: !canCreate }, "New Team")),
            React.createElement(VerticalGroup, { spacing: 'md' },
                React.createElement("div", { className: styles.wrapper },
                    React.createElement(InteractiveTable, { columns: columns, data: teams, getRowId: (team) => String(team.id), fetchData: changeSort }),
                    React.createElement(HorizontalGroup, { justify: "flex-end" },
                        React.createElement(Pagination, { hideWhenSinglePage: true, currentPage: page, numberOfPages: totalPages, onNavigate: changePage })))))))));
};
const getStyles = (theme) => {
    return {
        // Enable RolePicker overflow
        wrapper: css({
            display: 'flex',
            flexDirection: 'column',
            overflowX: 'auto',
            overflowY: 'hidden',
            minHeight: '100vh',
            width: '100%',
            '& > div': {
                overflowX: 'unset',
                marginBottom: theme.spacing(2),
            },
        }),
    };
};
function shouldDisplayRolePicker() {
    return (contextSrv.licensedAccessControlEnabled() &&
        contextSrv.hasPermission(AccessControlAction.ActionTeamsRolesList) &&
        contextSrv.hasPermission(AccessControlAction.ActionRolesList));
}
function mapStateToProps(state) {
    return {
        teams: state.teams.teams,
        query: state.teams.query,
        perPage: state.teams.perPage,
        page: state.teams.page,
        noTeams: state.teams.noTeams,
        totalPages: state.teams.totalPages,
        hasFetched: state.teams.hasFetched,
    };
}
const mapDispatchToProps = {
    loadTeams,
    deleteTeam,
    changePage,
    changeQuery,
    changeSort,
};
const connector = connect(mapStateToProps, mapDispatchToProps);
export default connector(TeamList);
//# sourceMappingURL=TeamList.js.map
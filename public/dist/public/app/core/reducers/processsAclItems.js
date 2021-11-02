export function processAclItems(items) {
    return items.map(processAclItem).sort(function (a, b) { return b.sortRank - a.sortRank || a.name.localeCompare(b.name); });
}
function processAclItem(dto) {
    var item = dto;
    item.sortRank = 0;
    if (item.userId > 0) {
        item.name = item.userLogin;
        item.sortRank = 10;
    }
    else if (item.teamId > 0) {
        item.name = item.team;
        item.sortRank = 20;
    }
    else if (item.role) {
        item.icon = 'fa fa-fw fa-street-view';
        item.name = item.role;
        item.sortRank = 30;
        if (item.role === 'Editor') {
            item.sortRank += 1;
        }
    }
    if (item.inherited) {
        item.sortRank += 100;
    }
    return item;
}
//# sourceMappingURL=processsAclItems.js.map
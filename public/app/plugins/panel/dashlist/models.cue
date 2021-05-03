package grafanaschema

Family: {
    lineages: [
        [
            {
                PanelOptions: {
                    showStarred: bool | *true
                    showRecentlyViewed: bool | *false
                    showSearch: bool | *false
                    showHeadings: bool | *true
                    maxItems: int | *10
                    query: string | *""
                    folderId?: int
                    tags: [...string] | *[]
                },
            }
        ]
    ]
    migrations: []
}

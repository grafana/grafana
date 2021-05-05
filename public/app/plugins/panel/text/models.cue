package grafanaschema

Family: {
    lineages: [
        [
            {
                TextMode: "html" | "markdown" @cuetsy(targetType="enum",withName="TextMode") 

                PanelOptions: {
                    mode: TextMode | *"markdown"
                    content: string | *"""
                    # Title

                    For markdown syntax help: [commonmark.org/help](https://commonmark.org/help/)
                    """
                }
            }
        ]
    ]
    migrations: []
}

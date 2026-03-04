package kinds

themeV0alpha1: {
  kind: "Theme"
  scope: "Namespaced"
  pluralName: "Themes"
  validation: {
    operations: [
      "CREATE",
      "UPDATE",
    ]
  }
  codegen: {
    ts: {
      enabled: true
    }
    go: {
      enabled: true
    }
  }
  schema: {
    spec: {
        name: string
        colors?: {
            mode?: "light" | "dark"
            primary?: #ColorSection
            secondary?: #ColorSection
            info?: #ColorSection
            error?: #ColorSection
            success?: #ColorSection
            warning?: #ColorSection
            text?: {
                primary?: string
                secondary?: string
                disabled?: string
                link?: string
                maxContrast?: string
            }
            background?: {
                canvas?: string
                primary?: string
                secondary?: string
                elevated?: string
            }
            border?: {
                weak?: string
                medium?: string
                strong?: string
            }
            gradients?: {
                brandVertical?: string
                brandHorizontal?: string
            }
            action?: {
                selected?: string
                selectedBorder?: string
                hover?: string
                hoverOpacity?: number
                focus?: string
                disabledBackground?: string
                disabledText?: string
                disabledOpacity?: number
            }
            scrollbar?: string
            hoverFactor?: number
            contrastThreshold?: number
            tonalOffset?: number
        }
        spacing?: {
            gridSize?: int
        }
        shape?: {
            borderRadius?: int
        }
        typography?: {
            fontFamily?: string
            fontFamilyMonospace?: string
            fontSize?: number
            fontWeightLight?: number
            fontWeightRegular?: number
            fontWeightMedium?: number
            fontWeightBold?: number
            htmlFontSize?: number
        }
        visualization?: #Visualization
    }
  }
}


#Color: string

#ColorSection: {
  name?: string
  main?: #Color
  shade?: #Color
  text?: #Color
  border?: #Color
  transparent?: #Color
  borderTransparent?: #Color
  contrastText?: #Color
}

#VisualizationShade: {
    color: string
    name: string
    aliases?: [...string]
    primary?: bool
}

#RedHue: {
    name: "red"
    shades: [...(#VisualizationShade & {
        name: "super-light-red" | "light-red" | "red" | "semi-dark-red" | "dark-red"
    })]
}

#OrangeHue: {
    name: "orange"
    shades: [...(#VisualizationShade & {
        name: "super-light-orange" | "light-orange" | "orange" | "semi-dark-orange" | "dark-orange"
    })]
}

#YellowHue: {
    name: "yellow"
    shades: [...(#VisualizationShade & {
        name: "super-light-yellow" | "light-yellow" | "yellow" | "semi-dark-yellow" | "dark-yellow"
    })]
}

#GreenHue: {
    name: "green"
    shades: [...(#VisualizationShade & {
        name: "super-light-green" | "light-green" | "green" | "semi-dark-green" | "dark-green"
    })]
}

#BlueHue: {
    name: "blue"
    shades: [...(#VisualizationShade & {
        name: "super-light-blue" | "light-blue" | "blue" | "semi-dark-blue" | "dark-blue"
    })]
}

#PurpleHue: {
    name: "purple"
    shades: [...(#VisualizationShade & {
        name: "super-light-purple" | "light-purple" | "purple" | "semi-dark-purple" | "dark-purple"
    })]
}

#Hue: #RedHue | #OrangeHue | #YellowHue | #GreenHue | #BlueHue | #PurpleHue

#Visualization: {
    hues?: [...#Hue]
    palette?: [...string]
}



# POC Demo Setup: Cómo Simular Integraciones Legacy

## Objetivo

Para demostrar el POC de versionado de integraciones, necesitas crear un contact point con una integración legacy (v0) para poder ver el badge visual en acción.

## Opción 1: Usar Contact Points Legacy Ya Incluidos ⭐ RECOMENDADO

**¡Ya está listo!** El POC incluye 2 contact points Mimir en los mocks para demostración:

### Contact Points Mimir Disponibles:

1. **"Legacy Slack from Mimir"**
   - Tipo: `slack_v0mimir1`
   - Versión: `v0mimir1`
   - Simula un Slack importado de Mimir Alert Manager

2. **"Legacy Webhook from Mimir"**
   - Tipo: `webhook_v0mimir1`
   - Versión: `v0mimir1`
   - Simula un webhook importado de Mimir

### Cómo Usarlos:

```bash
# 1. Arrancar Grafana en modo desarrollo
yarn start

# 2. Ir a Alerting > Contact points
# 3. Buscar "Legacy Slack from Mimir" o "Legacy Webhook from Mimir"
# 4. Hacer clic en "Edit"
# 5. ✅ Deberías ver:
#    - Badge naranja "Legacy (Mimir)"
#    - Badge naranja "V0MIMIR1"
#    - Alerta azul informativa
#    - Todos los campos deshabilitados (read-only)
```

### Qué Esperar Ver:

```
Integration: [Slack ▼]  ← Dropdown HABILITADO
[🔶 Legacy (Mimir)] [V0MIMIR1]  ← Badges naranjas

[ℹ️ Legacy Integration - Read Only]
This integration was imported from Mimir...

Recipient: [#alerts-legacy] ← DISABLED (gris)
Username:  [Mimir...]       ← DISABLED
Token:     [****]           ← DISABLED
```

### Si Quieres Agregar Más:

Archivo: `public/app/features/alerting/unified/mocks/server/entities/alertmanager-config/grafana-alertmanager-config.ts`

Agregar a la lista de `receivers` (línea ~176):

```typescript
{
  name: 'Mi Contact Point Mimir',
  grafana_managed_receiver_configs: [
    {
      uid: 'mi-mimir-uid',
      name: 'Mi Contact Point Mimir',
      type: 'email_v0mimir1',  // <-- Tipo con _v0mimir1
      disableResolveMessage: false,
      settings: {
        addresses: 'test@example.com',
      },
      secureFields: {},
    },
  ],
},
```

### Versiones Soportadas:

- `v1` - Grafana integrations (actual)
- `v0mimir1` - Mimir integrations base (legacy)
- `v0mimir2` - Mimir msteamsv2 (si existe en tu setup)

## Opción 2: Modificar Transformación de Datos (Para Demo Rápida)

Para una demo rápida, puedes forzar que un contact point existente se vea como legacy:

### En GrafanaReceiverForm.tsx

Temporalmente, después de la línea donde se crea `enrichedNotifiers`, agrega:

```typescript
// TEMPORAL: Para demo, forzar el primer Slack a ser v0
const enrichedNotifiers = enrichNotifiersWithVersionsPOC(grafanaNotifiers).map((n) => {
  if (n.type === 'slack' && n.version === 'v1') {
    // Crear una versión que simule ser legacy
    return {
      ...n,
      type: 'slack_v0' as any,
      version: 'v0',
      deprecated: true,
      canCreate: false,
    };
  }
  return n;
});
```

## Opción 3: Usar Browser DevTools con K8s API

⚠️ **Más complicado porque usa K8s API**

### Paso 1: Identificar el Endpoint K8s

El endpoint es: `/apis/notifications.alerting.grafana.app/v0alpha1/namespaces/{namespace}/receivers`

### Paso 2: Interceptar con DevTools Overrides

1. Abre DevTools > Sources tab
2. Habilita "Local Overrides"
3. Intercepta el endpoint de K8s API
4. Modifica el `type` de una integración a `slack_v0` en el response

Ejemplo de estructura K8s:

```json
{
  "items": [{
    "metadata": { "uid": "test-uid", ... },
    "spec": {
      "title": "mi-slack-test",
      "integrations": [{
        "type": "slack_v0",  // <-- Tipo legacy
        "settings": { "recipient": "#test" }
      }]
    }
  }]
}
```

**Nota:** Esta opción es compleja porque la estructura K8s difiere de la config de Alertmanager.

## Opción 4: Script de Datos de Prueba

Crea un archivo temporal para inyectar datos:

### En useContactPoints.ts

Agrega temporalmente después de obtener los contact points:

```typescript
// TEMPORAL: Inyectar contact point legacy para demo
if (contactPoints && contactPoints.length > 0) {
  contactPoints.push({
    name: 'legacy-slack-demo',
    grafana_managed_receiver_configs: [
      {
        uid: 'demo-legacy-uid',
        name: 'legacy-slack-demo',
        type: 'slack_v0', // <-- Legacy type
        disableResolveMessage: false,
        settings: {
          url: 'https://hooks.slack.com/services/DEMO',
        },
        secureFields: {},
      },
    ],
    metadata: {},
  });
}
```

## Verificación

Una vez que hayas configurado una integración legacy, verifica:

### 1. En la Lista de Contact Points

- El contact point legacy debería aparecer normalmente

### 2. Al Editar el Contact Point

- ✅ Deberías ver un **badge naranja** con "Legacy (Mimir)"
- ✅ El badge debe tener un icono de warning (triángulo)
- ✅ Al hacer hover, debe mostrar el tooltip explicativo

### 3. Al Crear Nuevo Contact Point

- ✅ NO debes ver la opción legacy en el dropdown
- ✅ Solo debe aparecer "Slack" (sin duplicados)

### 4. Console del Browser

Abre la consola y busca:

```javascript
// Busca en los notifiers
console.log(notifiers.filter((n) => n.dto.version === 'v0'));
// Debería mostrar los notifiers legacy
```

## Demo Flow Recomendado

### Para Mostrar al Equipo:

1. **Intro (2 min)**
   - Explicar el problema: Mimir vs Grafana integrations
   - Mostrar las 3 etapas del plan

2. **Crear Contact Point (3 min)**
   - Abrir dropdown de integraciones
   - Mostrar que NO hay duplicados
   - Mostrar que solo aparecen versiones latest
   - Ver console: mostrar que existen v0 y v1 en los datos

3. **Editar Contact Point Legacy (5 min)**
   - Abrir el contact point legacy preparado
   - Mostrar el badge "Legacy (Mimir)"
   - Explicar que no se puede crear nuevos legacy
   - Mostrar tooltip

4. **Código (5 min)**
   - Mostrar `notifier-versions-poc.ts`
   - Explicar qué viene del backend en producción
   - Mostrar los cambios en `ChannelSubForm.tsx`

5. **Q&A (5 min)**

## Cleanup Después de la Demo

Recuerda remover cualquier código temporal:

- ❌ Overrides en DevTools
- ❌ Inyecciones de datos hardcodeados
- ❌ Modificaciones a transformaciones de datos

El POC debe funcionar solo con los archivos modificados oficialmente:

- ✅ `types/alerting.ts`
- ✅ `utils/notifier-versions-poc.ts`
- ✅ `components/receivers/form/ChannelSubForm.tsx`
- ✅ `components/receivers/form/GrafanaReceiverForm.tsx`

## Troubleshooting

### No veo el badge legacy

- Verifica que el notifier tenga `version: 'v0'` o `deprecated: true`
- Revisa que estás en modo **edición** no creación
- Comprueba que el tipo sea correcto (e.g., `slack_v0`)

### Veo duplicados en el dropdown

- Revisa que `getLatestVersions()` esté funcionando
- Verifica que el filtrado en `ChannelSubForm` esté aplicado

### El POC no está activo

- Confirma que `enrichNotifiersWithVersionsPOC()` se está llamando en `GrafanaReceiverForm`
- Verifica imports correctos

## Contacto

Para dudas sobre la configuración del POC, contacta al equipo de Alerting.

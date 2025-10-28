# 🚀 POC: Versionado de Integraciones - Resumen Ejecutivo

## ¿Qué hemos implementado?

Un POC completamente funcional en el **frontend** que demuestra el versionado de integraciones para la migración de **Mimir Alert Manager** a **Grafana Alert Manager** unificado.

⚠️ **IMPORTANTE:** Esto es **SOLO para Grafana Alert Manager**, NO para Cloud/External Alert Managers.

---

## 🎯 Problema que Resuelve

Cuando importamos configuraciones de Mimir a Grafana:

- Existen **2 versiones** de la misma integración (ej: Slack v0 de Mimir, Slack v1 de Grafana)
- Las integraciones legacy deben ser **visibles pero no creables**
- El usuario no debe ver duplicados ni complejidad innecesaria

---

## ✅ Lo que Funciona Ahora

### 1. **Crear Nuevo Contact Point**

- ✅ El dropdown solo muestra la **última versión** de cada integración
- ✅ NO hay duplicados (solo aparece "Slack", no "Slack" dos veces)
- ✅ Las versiones legacy (v0) **NO aparecen** en el dropdown

### 2. **Editar Contact Point Existente con Integración Legacy**

- ✅ **Dropdown habilitado** - Puedes cambiar el tipo de integración (conversión manual)
- ✅ **Badge naranja** "Legacy (Mimir)" con icono de warning debajo del dropdown
- ✅ **Badge gris** "Version v0" mostrando la versión
- ✅ Tooltip: "Settings are read-only but you can change to a different integration type to convert"
- ✅ **Campos de settings deshabilitados (read-only)** - NO se pueden editar mientras sea v0
- ✅ **Alerta informativa** azul explicando que es legacy importada de Mimir
- ✅ **Si cambias a otra integración** (Email, Webhook) → campos se habilitan (usas v1)
- ✅ **Stage 2:** Settings read-only pero permite conversión cambiando tipo
- ⏳ **Stage 3:** Botón "Convert to latest version" para migrar Slack v0 → Slack v1

### 3. **Datos Mockeados en Frontend**

- ✅ Simula que el backend devuelve notifiers con `version`, `deprecated`, `canCreate`
- ✅ Integraciones con versión legacy: **Slack, Webhook, Email, Telegram, Discord**

---

## 📁 Archivos Modificados

### 1. **Types** - `types/alerting.ts`

Agregamos campos a `NotifierDTO`:

```typescript
version?: string;       // "v0" (legacy) o "v1" (grafana)
deprecated?: boolean;   // true si es legacy
canCreate?: boolean;    // false para legacy
```

### 2. **POC Utils** - `utils/notifier-versions-poc.ts` (NUEVO)

Funciones helper que simulan la respuesta del backend:

- `enrichNotifiersWithVersionsPOC()` - Crea versiones legacy mockeadas
- `getLatestVersions()` - Filtra solo versiones creables
- `groupNotifiersByName()` - Agrupa por nombre base

### 3. **UI** - `components/receivers/form/ChannelSubForm.tsx`

- Filtra dropdown para mostrar solo últimas versiones
- Muestra badge "Legacy (Mimir)" para integraciones v0
- Badge naranja con icono de warning

### 4. **Form** - `components/receivers/form/GrafanaReceiverForm.tsx`

- Enriquece los notifiers con versiones usando el helper POC
- **SOLO para Grafana AM**, CloudReceiverForm NO está modificado

### 5. **Documentación**

- `POC_INTEGRATION_VERSIONING.md` - Documentación técnica completa
- `POC_DEMO_SETUP.md` - Instrucciones para preparar la demo
- `RESUMEN_POC_ES.md` - Este archivo

---

## 🎬 Cómo Demostrar el POC

### Preparación (0 min - Ya está listo!)

**¡No necesitas preparación!** El POC incluye 2 contact points legacy en los mocks:

- "Legacy Slack from Mimir" (tipo: `slack_v0`)
- "Legacy Webhook" (tipo: `webhook_v0`)

Solo arranca Grafana con `yarn start` y ve a Alerting > Contact points.

### Demo al Equipo (20 min)

#### 1. Crear Contact Point (5 min)

```
1. Ir a Alerting > Contact Points > New
2. Abrir dropdown de Integration
3. Mostrar: NO hay duplicados
4. Mostrar: Solo versiones latest (v1)
5. Abrir console del browser
6. Buscar notifiers con version: "v0" → existen pero no se muestran
```

#### 2. Editar Contact Point Legacy (5 min)

```
1. Editar un contact point con integración legacy (preparado antes)
2. Mostrar el badge naranja "Legacy (Mimir)"
3. Hover sobre el badge → tooltip explicativo
4. Intentar cambiar integración → solo aparecen versiones latest
```

#### 3. Explicar el Código (5 min)

```
1. Mostrar notifier-versions-poc.ts
2. Explicar que esto simula lo que el backend devolverá
3. Mostrar ChannelSubForm.tsx cambios
4. Mostrar GrafanaReceiverForm.tsx integración
```

#### 4. Roadmap Backend (5 min)

```
1. Explicar qué debe devolver el backend
2. Mostrar ejemplo de response esperado
3. Cómo quitar el POC cuando backend esté listo
```

---

## 🔄 Las 3 Etapas del Plan

### **Stage 1: Import** (Backend ya lo hace)

- Mimir configs se importan y guardan en DB
- Grafana corre ambas configuraciones (merged)
- Frontend: sin cambios

### **Stage 2: Read-Only Display** ← **ESTAMOS AQUÍ (POC)**

- Integraciones importadas se muestran como provisioned/read-only
- Versiones legacy visibles con badges
- **Frontend: Este POC implementa Stage 2**

### **Stage 3: Conversion** (Futuro)

- Usuario hace "convert" para hacer editable la config
- UI de migración de versiones
- **Frontend: Trabajo futuro - botón "Convert/Migrate"**

---

## 🔌 Contrato con Backend

Cuando el backend esté listo, debe devolver en `/api/alert-notifiers`:

```json
[
  {
    "name": "Slack",
    "type": "slack",
    "version": "v1",
    "deprecated": false,
    "canCreate": true,
    "options": [...]
  },
  {
    "name": "Slack",
    "type": "slack_v0",      // ← Tipo diferente para legacy
    "version": "v0",
    "deprecated": true,
    "canCreate": false,       // ← No se puede crear
    "options": [...]
  }
]
```

**Clave:** Tipos diferentes (`slack` vs `slack_v0`) permiten distinguir versiones.

---

## 🧹 Cómo Migrar a Producción

### Paso 1: Backend Implementa Versioning

Backend debe:

1. Devolver campo `version` en notifiers
2. Devolver campo `deprecated`
3. Devolver campo `canCreate`
4. Usar tipos diferentes para versiones (ej: `slack` vs `slack_v0`)

### Paso 2: Remover POC del Frontend

```typescript
// EN: GrafanaReceiverForm.tsx
// QUITAR estas líneas:
import { enrichNotifiersWithVersionsPOC } from '../../../utils/notifier-versions-poc';
const enrichedNotifiers = enrichNotifiersWithVersionsPOC(grafanaNotifiers);

// USAR directamente:
const notifiers: Notifier[] = grafanaNotifiers.map((n) => {
  // ... resto del código
});
```

### Paso 3: Limpiar Archivos POC

```bash
# OPCIONAL: Eliminar archivo POC cuando backend esté completo
rm public/app/features/alerting/unified/utils/notifier-versions-poc.ts
```

### Paso 4: El Resto Queda Igual

- ✅ `ChannelSubForm.tsx` - Ya maneja versiones correctamente
- ✅ `types/alerting.ts` - Tipos ya extendidos
- ✅ UI del badge - Ya implementada

---

## ✨ Ventajas de Este Approach

### 1. **No Breaking Changes**

- Integraciones existentes siguen funcionando
- Usuario ve "Slack" no "Slack v1" (transparente)

### 2. **Migración Gradual**

- Legacy integrations siguen editables
- No se pueden crear nuevas legacy
- Usuario migra a su ritmo (Stage 3)

### 3. **Backward Compatible**

- Si backend no devuelve `version`, todo sigue funcionando
- POC no rompe nada, solo agrega funcionalidad

### 4. **Extensible**

- Fácil agregar más versiones en el futuro (v2, v3...)
- Framework genérico, no específico a integraciones

---

## 📊 Testing

### Casos de Prueba

#### ✅ Crear Contact Point

```
- Dropdown solo muestra últimas versiones
- No hay duplicados
- Legacy versions NO aparecen
```

#### ✅ Editar Contact Point con Legacy Integration

```
- Badge "Legacy (Mimir)" visible
- Badge naranja con icono warning
- Tooltip explicativo
```

#### ✅ Editar Contact Point Normal (v1)

```
- NO muestra badge
- Funciona normal
```

#### ✅ Backend sin Versioning (Fallback)

```
- Si backend no devuelve version, funciona como antes
- No se rompe nada
```

---

## 🐛 Conocidos Issues / Limitaciones

### 1. **POC usa Datos Mockeados**

- Solo simula 5 integraciones con legacy: Slack, Webhook, Email, Telegram, Discord
- En producción, backend dirá cuáles tienen versiones

### 2. **No hay Migración Automática**

- Stage 3 (Convert) no está implementado
- Usuario no puede "upgrade" una integración legacy todavía

### 3. **Solo Grafana Alert Manager**

- Cloud/External Alert Managers NO usan esto
- CloudReceiverForm NO está modificado

---

## 📝 Notas para el Equipo Backend

### Lo que el Frontend Necesita:

1. **Campo `version` en NotifierDTO**
   - Ejemplo: `"v0"`, `"v1"`

2. **Campo `deprecated` booleano**
   - `true` para versiones legacy que no deben usarse en nuevos contact points

3. **Campo `canCreate` booleano**
   - `false` para versiones legacy
   - `true` para versiones actuales

4. **Tipos de integración distintos**
   - Grafana: `"slack"`
   - Mimir/Legacy: `"slack_v0"`
   - Esto permite al frontend distinguir qué versión usar

5. **Endpoint**: `/api/alert-notifiers`
   - Ya existe, solo agregar campos

---

## 📋 Templates Versionados (Requisito Adicional)

### **Decisión de Diseño:**

Los **templates también tienen versiones** y deben coincidir con la versión de la integración:

- **Templates Mimir (v0)** → Solo se pueden usar en **integraciones v0**
- **Templates Grafana (v1)** → Solo se pueden usar en **integraciones v1**

### **Impacto en Frontend:**

1. **Autocomplete de templates** debe filtrar por versión de integración
2. **Template definition page** debe mostrar badge de versión
3. No se pueden crear templates v0 vía UI (solo importados)

### **NO Incluido en Este POC:**

Este POC se enfoca **solo en integraciones**. Templates se implementarán en fase posterior.

---

## 🎯 Next Steps

### Inmediato (Esta Semana)

- ✅ Demo del POC al equipo
- ⏳ Feedback del equipo
- ⏳ Refinamientos según feedback

### Corto Plazo (2-4 Semanas)

- ⏳ Backend implementa campos de versioning para integraciones
- ⏳ Backend implementa campos de versioning para templates
- ⏳ Testing con datos reales de Mimir
- ⏳ Quitar POC, usar datos reales

### Medio Plazo (1-2 Meses)

- ⏳ Frontend: filtrado de templates por versión
- ⏳ Stage 3: UI de conversión
- ⏳ Botón "Migrate to Latest"
- ⏳ Migración automática donde sea posible

---

## 🤝 Contribuyendo

### Si encuentras bugs:

1. Check si es parte del POC (datos mockeados) o lógica real
2. Reportar en el issue tracker del equipo

### Si quieres agregar features:

1. Discutir con el equipo primero
2. Recordar que esto es temporal hasta que backend esté listo

---

## 📚 Recursos Adicionales

- **Documentación Técnica**: `POC_INTEGRATION_VERSIONING.md`
- **Setup de Demo**: `POC_DEMO_SETUP.md`
- **Código POC**: `utils/notifier-versions-poc.ts`
- **Gong Call**: [Link al call donde se discutió](https://us-53469.app.gong.io/call?id=2073440669747056988)

---

## ❓ Preguntas Frecuentes

### P: ¿Afecta a contact points existentes?

**R:** No. Contact points existentes funcionan igual. Solo se verán badges si tienen integraciones legacy.

### P: ¿Los usuarios pueden cambiar la versión manualmente?

**R:** No en Stage 2. En Stage 3 habrá un botón "Migrate/Convert".

### P: ¿Qué pasa si el backend no está listo?

**R:** El POC usa datos mockeados. Funciona independiente del backend.

### P: ¿Esto rompe Cloud Alert Managers?

**R:** No. Solo afecta Grafana Alert Manager. CloudReceiverForm no está tocado.

### P: ¿Cuándo se puede quitar el código POC?

**R:** Cuando backend devuelva los campos `version`, `deprecated`, `canCreate` correctamente.

---

**¡El POC está listo para demostrar! 🎉**

Si tienes dudas, revisa la documentación técnica o contacta al equipo de Alerting.
